'use client';
import Link from 'next/link';
import { useLanguageState,useThemeState } from '@/components/app-preferences';
import { PageControls } from '@/components/page-controls';
import { UiText } from "@/components/ui-text";
import { usePagedCollection } from '@/hooks/use-paged-collection';
import { formatForumDate } from '@/lib/date-format';
import { readForumPost } from '@/lib/public-firestore-schema';
import { deleteForumPost } from '@/lib/forum-client';
import { uiMessage } from '@/lib/i18n';
import { subjectOptions } from '@/lib/subjects';
import { useMemo as usePageMemo } from 'react';

import ActivityCalendar from '@/components/activity-calendar';
import FeatureHelp from '@/components/feature-help';
import { LatexText } from '@/components/latex-text';
import Navigation from '@/components/navigation';
import QuickNotes from '@/components/quick-notes';
import {
AlertDialog,
AlertDialogAction,
AlertDialogCancel,
AlertDialogContent,
AlertDialogDescription,
AlertDialogFooter,
AlertDialogHeader,
AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar,AvatarFallback,AvatarImage } from '@/components/ui/avatar';
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import {
DropdownMenu,
DropdownMenuContent,
DropdownMenuItem,
DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { useFirestore,useUser } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useUserNotes } from '@/firebase/firestore/use-user-notes';
import { useToast } from '@/hooks/use-toast';
import { translations,TranslationSet } from '@/lib/translations';
import { ForumPost } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
addDoc,
arrayRemove,
arrayUnion,
collection,
doc,
increment,
orderBy,
query,
serverTimestamp,
updateDoc,
where
} from 'firebase/firestore';
import {
BookOpen,
ChevronDown,
ChevronUp,
Clock,
Filter,
Heart,
MessageSquare,
MoreVertical,
Pencil,
Plus,
Search,
Star,
Trash2
} from 'lucide-react';

import React,{ useMemo,useRef,useState } from 'react';

import { LatexQuickToolbar } from '@/components/latex-toolbar';
import { useMutation } from '@/hooks/use-mutation';

export default function ForumPage() {
  const { user, loading: authLoading } = useUser();
  const db = useFirestore();
  const mutation = useMutation();

  const { toast } = useToast();

  const [lang, setLang] = useLanguageState();
  const [theme, setTheme] = useThemeState();


  const [sortType, setSortType] = useState<'newest' | 'oldest' | 'mostLiked'>('newest');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const publishing = useRef(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Create/Edit States
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newSubject, setNewSubject] = useState<string>('other');
  const [editingPost, setEditingPost] = useState<ForumPost | null>(null);
  const [postToDelete, setPostToDelete] = useState<ForumPost | null>(null);

  const { notes: personalNotes, updateNotes: onNotesChange } = useUserNotes();


  const source = usePageMemo(() => db ? query(collection(db, 'posts'), ...(sortType === 'mostLiked' ? [orderBy('likesCount', 'desc'), orderBy('createdAt', 'desc')] : [orderBy('createdAt', sortType === 'oldest' ? 'asc' : 'desc')])) : null, [db, sortType]);
  const page = usePagedCollection<ForumPost>(source, readForumPost);
  const { items: posts, loading } = page;
  const deletionSource = usePageMemo(() => db && user ? query(collection(db, '_forumDeletions'), where('authorId', '==', user.uid), where('status', '==', 'pending')) : null, [db, user]);
  const deletions = usePagedCollection(deletionSource, (id, data) => data.authorId === user?.uid && data.status === 'pending' ? id : null);
  const resumeDeletion = async (id: string) => {
    if (!user) return;
    await mutation.run(() => deleteForumPost(user, id), cause => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `posts/${id}`, operation: 'delete' }, cause));
    });
  };

  const t: TranslationSet = translations[lang];

  const subjectsList = subjectOptions(t);

  const filteredPosts = useMemo(() => {
    let result = posts;

    if (filterSubject !== 'all') {
      result = result.filter(post => post.subject === filterSubject);
    }

    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(post =>
        post.title.toLowerCase().includes(lowerQuery) ||
        post.content.toLowerCase().includes(lowerQuery)
      );
    }

    return result;
  }, [posts, searchQuery, filterSubject]);

  const handleCreatePost = async () => {
    if (publishing.current) return;
    if (!user || !db) {
      toast({ variant: "destructive", title: t.mustLoginToInteract });
      return;
    }
    if (!newTitle.trim() || !newContent.trim()) {
      toast({ variant: "destructive", title: t.requiredFields });
      return;
    }
    if (newTitle.length > 200 || newContent.length > 20000) {
      toast({ variant: 'destructive', title: uiMessage(lang, 'forum.post_too_long') });
      return;
    }

    const postData = {
      title: newTitle,
      content: newContent,
      subject: newSubject,
      authorId: user.uid,
      authorName: user.displayName || 'Learner',
      authorPhoto: user.photoURL || '',
      createdAt: serverTimestamp(),
      likesCount: 0,
      commentsCount: 0,
      likedBy: []
    };

    publishing.current = true;
    setIsPublishing(true);
    try {
      await addDoc(collection(db, 'posts'), postData);
      setIsCreateDialogOpen(false);
      setNewTitle('');
      setNewContent('');
      setNewSubject('other');
      toast({ title: uiMessage(lang, 'forum.posted_successfully') });
    } catch (cause) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'posts', operation: 'create', requestResourceData: postData }, cause));
    } finally {
      publishing.current = false;
      setIsPublishing(false);
    }
  };

  const handleUpdatePost = async () => {
    if (!user || !db || !editingPost) return;
    if (!newTitle.trim() || !newContent.trim()) return;

    const postRef = doc(db, 'posts', editingPost.id);
    const updateData = {
      title: newTitle,
      content: newContent,
      subject: newSubject,
      updatedAt: serverTimestamp()
    };

    const result = await mutation.run(() => updateDoc(postRef, updateData), cause => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: postRef.path, operation: 'update', requestResourceData: updateData }, cause));
    });
    if (result.ok) { setEditingPost(null);
        toast({ title: uiMessage(lang, "forum.updated_successfully") });
        setNewTitle("");
        setNewContent("");
        setNewSubject("other");

    }
    return result;
  };

  const handleDeletePost = async () => {
    if (!user || !db || !postToDelete) return;

    const postRef = doc(db, 'posts', postToDelete.id);
    const result = await mutation.run(() => deleteForumPost(user, postToDelete.id), cause => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: postRef.path, operation: 'delete' }, cause));
    });
    if (result.ok) { setPostToDelete(null);
        toast({ title: uiMessage(lang, "forum.post_deleted") });

    }
    return result;
  };

  const insertLatex = (target: 'title' | 'content', type: 'inline' | 'block') => {
    const wrapper = type === 'inline' ? '$' : '$$';
    if (target === 'title') {
      setNewTitle(prev => prev + wrapper + wrapper);
    } else {
      setNewContent(prev => prev + wrapper + wrapper);
    }
  };

  const insertSnippet = (target: 'title' | 'content', snippet: string) => {
    const wrappedSnippet = `$${snippet}$`;
    if (target === 'title') {
      setNewTitle(prev => prev + wrappedSnippet);
    } else {
      setNewContent(prev => prev + wrappedSnippet);
    }
  };

  const toggleLike = (e: React.MouseEvent, post: ForumPost) => {
    e.stopPropagation();
    if (!user || !db) {
      toast({ variant: "destructive", title: t.mustLoginToInteract });
      return;
    }

    const postRef = doc(db, 'posts', post.id);
    const hasLiked = post.likedBy?.includes(user.uid);

    updateDoc(postRef, {
      likedBy: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      likesCount: increment(hasLiked ? -1 : 1)
    }).catch(async cause => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: postRef.path, operation: 'update', requestResourceData: { userId: user.uid } }, cause));
    });
  };



  const getSortLabel = () => {
    if (sortType === 'newest') return t.newest;
    if (sortType === 'oldest') return t.oldest;
    if (sortType === 'mostLiked') return t.mostLiked;
    return t.newest;
  };

  const getSubjectLabel = (id: string) => {
    const s = subjectsList.find(sub => sub.id === id);
    return s ? s.label : t.other;
  };

  const getSubjectColor = (id: string) => {
    switch (id) {
      case 'math': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'physics': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'chemistry': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'biology': return 'bg-teal-500/10 text-teal-600 border-teal-500/20';
      case 'literature': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'english': return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
      default: return 'bg-muted/50 text-muted-foreground border-border';
    }
  };


  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-500">
      <Navigation
        view="forum" setView={() => {}} lang={lang}
        changeLang={(l) => { setLang(l);  }}
        theme={theme} onThemeChange={(isDark) => {
          const nt = isDark ? 'dark' : 'light';
          setTheme(nt);


        }} t={t}
      />

      <div className="fixed left-0 top-32 md:top-40 z-[90] flex flex-col gap-2 md:gap-3 animate-in slide-in-from-left-4 duration-1000">
        <ActivityCalendar t={t} lang={lang} isSticky />
        <QuickNotes
          t={t}
          lang={lang}
          isSticky
          notes={personalNotes}
          onNotesChange={onNotesChange}
        />
      </div>

      <main className="flex-1 main-container pt-24 md:pt-36 space-y-6 md:space-y-10 pb-20 px-2 sm:px-4">
      <PageControls lang={lang} {...page} />
      {deletions.items.length > 0 && <Card className="p-4 space-y-3" role="status">
        <p>{lang === 'vi' ? 'Bài viết đã được ẩn. Hãy thử lại để hoàn tất xóa dữ liệu còn lại.' : 'Your posts are hidden. Retry to finish deleting the remaining data.'}</p>
        {deletions.items.map(id => <Button key={id} disabled={mutation.pending} onClick={() => void resumeDeletion(id)}>
          {lang === 'vi' ? 'Tiếp tục xóa' : 'Resume deletion'} ({id})
        </Button>)}
        <PageControls lang={lang} {...deletions} />
      </Card>}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 border-b-[3px] md:border-b-[5px] border-border/30 pb-6 md:pb-8">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-4xl md:text-7xl font-headline font-black text-primary uppercase tracking-tighter flex items-center gap-2.5 md:gap-4">
              <MessageSquare className="w-7 h-7 md:w-16 md:h-16" /> {t.forum}
              <FeatureHelp
                helpTitle={t.helpTitle}
                title={t.forum}
                items={t.forumHelp}
                storageKey="shark_help_forum_seen"
              />
            </h1>
            <p className="text-[8px] md:text-sm font-black text-muted-foreground uppercase tracking-[0.15em] md:tracking-[0.2em] opacity-60">
              {uiMessage(lang, "forum.shark_empti_learning_community")}
            </p>
          </div>

          <div className="flex items-center gap-1.5 md:gap-3 flex-wrap justify-end">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="btn-duo h-9 md:h-12 rounded-xl md:rounded-2xl border-[2px] md:border-[3px] font-black uppercase text-[9px] md:text-xs tracking-widest gap-1.5 bg-card">
                  <Filter className="w-3 h-3 md:w-4 md:h-4" />
                  {filterSubject === 'all' ? t.allSubjects : getSubjectLabel(filterSubject)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl md:rounded-[1.5rem] border-[3px] p-1.5 shadow-2xl animate-in slide-in-from-top-2">
                <DropdownMenuItem onClick={() => setFilterSubject('all')} className="font-black uppercase text-[9px] md:text-[10px] p-2 md:p-3 rounded-lg md:rounded-xl cursor-pointer">
                  {t.allSubjects}
                </DropdownMenuItem>
                {subjectsList.map(s => (
                  <DropdownMenuItem key={s.id} onClick={() => setFilterSubject(s.id)} className="font-black uppercase text-[9px] md:text-[10px] p-2 md:p-3 rounded-lg md:rounded-xl cursor-pointer">
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="btn-duo h-9 md:h-12 rounded-xl md:rounded-2xl border-[2px] md:border-[3px] font-black uppercase text-[9px] md:text-xs tracking-widest gap-1.5 bg-card">
                  {sortType === 'newest' ? <ChevronDown className="w-3 h-3 md:w-4 md:h-4" /> : <ChevronUp className="w-3 h-3 md:w-4 md:h-4" />}
                  {getSortLabel()}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl md:rounded-[1.5rem] border-[3px] p-1.5 shadow-2xl animate-in slide-in-from-top-2">
                <DropdownMenuItem onClick={() => setSortType('newest')} className="font-black uppercase text-[9px] md:text-[10px] p-2 md:p-3 rounded-lg md:rounded-xl cursor-pointer">
                  {t.newest}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortType('oldest')} className="font-black uppercase text-[9px] md:text-[10px] p-2 md:p-3 rounded-lg md:rounded-xl cursor-pointer">
                  {t.oldest}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortType('mostLiked')} className="font-black uppercase text-[9px] md:text-[10px] p-2 md:p-3 rounded-lg md:rounded-xl cursor-pointer flex items-center gap-2">
                  <Star className="w-3 h-3 fill-current" /> {t.mostLiked}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={!authLoading && isCreateDialogOpen} onOpenChange={open => { if (!publishing.current && !authLoading) setIsCreateDialogOpen(open); }}>
              <Button disabled={authLoading} onClick={() => setIsCreateDialogOpen(true)} className="btn-duo h-9 md:h-12 px-3 md:px-6 rounded-xl md:rounded-2xl bg-primary text-white border-[2px] md:border-[3px] border-primary/20 font-black uppercase text-[9px] md:text-xs tracking-widest gap-1.5">
                <Plus className="w-3.5 h-3.5 md:w-5 md:h-5" /> {t.createPost}
              </Button>
              <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-[1.5rem] md:rounded-[2.5rem] border-[3px] md:border-[4px] border-border shadow-2xl p-5 md:p-8 bg-card animate-in zoom-in-95 duration-300 custom-scrollbar"><fieldset disabled={mutation.pending} className="contents">
                <DialogHeader>
                  <DialogTitle className="text-xl md:text-3xl font-headline font-black text-primary uppercase tracking-tight text-left">
                    {t.createPost.toUpperCase()}
                  </DialogTitle>
                </DialogHeader>
                <fieldset disabled={isPublishing} className="space-y-5 md:space-y-6 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t.postTitle}</label>
                        <div className="flex flex-wrap gap-1.5">
                          <Button variant="ghost" size="sm" onClick={() => insertLatex('title', 'inline')} className="h-7 px-2 text-[9px] font-black bg-muted/50 rounded-lg hover:bg-primary/10 transition-all"><UiText id="inlineMath" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => insertLatex('title', 'block')} className="h-7 px-2 text-[9px] font-black bg-muted/50 rounded-lg hover:bg-primary/10 transition-all"><UiText id="blockMath" /></Button>
                        </div>
                      </div>
                      <Input
                        placeholder={uiMessage(lang, "forum.enter_post_title")}
                        maxLength={200}
                        className="h-12 md:h-14 rounded-xl md:rounded-2xl border-[3px] border-border font-black text-sm md:text-lg focus:ring-4 focus:ring-primary/10 transition-all bg-muted/10"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                        <BookOpen className="w-3 h-3" /> {t.subjectTag}
                      </label>
                      <Select value={newSubject} onValueChange={setNewSubject}>
                        <SelectTrigger className="h-12 md:h-14 rounded-xl md:rounded-2xl border-[3px] border-border font-black text-sm md:text-lg bg-muted/10">
                          <SelectValue placeholder={t.selectSubject} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-[3px]">
                          {subjectsList.map(s => (
                            <SelectItem key={s.id} value={s.id} className="font-black uppercase text-[10px] md:text-xs">
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t.postContent}</label>
                      <div className="flex flex-wrap gap-1.5">
                        <Button variant="ghost" size="sm" onClick={() => insertLatex('content', 'inline')} className="h-7 px-2 text-[9px] font-black bg-muted/50 rounded-lg hover:bg-primary/10 transition-all"><UiText id="inlineMath" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => insertLatex('content', 'block')} className="h-7 px-2 text-[9px] font-black bg-muted/50 rounded-lg hover:bg-primary/10 transition-all"><UiText id="blockMath" /></Button>
                      </div>
                    </div>

                    <LatexQuickToolbar onSelect={(s) => insertSnippet('content', s)} />

                    <Textarea
                      placeholder={t.postContent}
                      maxLength={20000}
                      className="min-h-[120px] md:min-h-[200px] rounded-xl md:rounded-2xl border-[3px] border-border font-bold text-xs md:text-base p-4 md:p-6 focus:ring-4 focus:ring-primary/10 transition-all bg-muted/10"
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                    />
                  </div>

                  <Button
                    onClick={handleCreatePost}
                    disabled={isPublishing}
                    aria-busy={isPublishing}
                    className="w-full h-14 md:h-16 rounded-xl md:rounded-2xl btn-duo bg-primary text-white font-black uppercase text-xs md:text-base tracking-widest border-[3px] border-primary/20"
                  >
                    {t.publish}
                  </Button>
                </fieldset>
              </fieldset></DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="relative group max-w-2xl mx-auto w-full">
          <div className="absolute inset-y-0 left-4 md:left-6 flex items-center pointer-events-none">
            <Search className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          </div>
          <Input
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 md:h-16 pl-10 md:pl-14 pr-4 md:pr-6 rounded-xl md:rounded-3xl border-[2px] md:border-4 border-border font-black text-sm md:text-xl focus:ring-4 md:ring-8 focus:ring-primary/10 transition-all bg-card shadow-duo"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="card-duo h-28 md:h-48 bg-muted/20 animate-pulse border-dashed" />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 md:py-24 text-center space-y-4 opacity-50 px-4">
            <Search className="w-12 h-12 md:w-20 md:h-20 text-muted-foreground" />
            <p className="font-black uppercase tracking-widest text-[10px] md:text-lg max-w-xs md:max-w-md">
              {searchQuery ? (lang === 'vi' ? `Không tìm thấy cho "${searchQuery}"` : `No results for "${searchQuery}"`) : t.noPosts}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:gap-8">
            {filteredPosts.map((post) => (
              <Card
                key={post.id}
                className="card-duo p-4 md:p-8 hover:translate-y-[-4px] transition-all bg-card border-border/50 group"

              >
                <div className="flex gap-3 md:gap-6">
                  <Avatar className="w-9 h-9 md:w-16 md:h-16 rounded-xl md:rounded-2xl border-2 md:border-4 border-border shadow-duo group-hover:border-primary/30 transition-colors shrink-0">
                    <AvatarImage src={post.authorPhoto} />
                    <AvatarFallback className="bg-primary/10 text-primary font-black text-[10px] md:text-lg">{post.authorName[0]}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 space-y-2 md:space-y-4 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-2 min-w-0 flex-1">
                        <Badge variant="outline" className={cn("w-fit font-black uppercase text-[7px] md:text-[9px] tracking-widest border-2 py-0.5 md:py-1", getSubjectColor(post.subject))}>
                          {getSubjectLabel(post.subject)}
                        </Badge>
                        <h2 className="text-[13px] sm:text-lg md:text-2xl font-headline font-black text-foreground uppercase tracking-tight truncate group-hover:text-primary transition-colors leading-tight">
                          <Link href={`/forum/${post.id}`} className="focus-visible:outline-2 focus-visible:outline-primary"><LatexText text={post.title} /></Link>
                        </h2>
                      </div>

                      <div
                        className="flex items-center gap-1.5 md:gap-2 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[6px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-0.5 md:gap-1">
                          <Clock className="w-2 md:w-3 h-2 md:h-3" /> {formatForumDate(post, lang, t.edited)}
                        </span>
                        {user?.uid === post.authorId && (
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button aria-label={lang === 'vi' ? 'Tùy chọn' : 'More options'} variant="ghost" size="icon" className="h-7 w-7 md:h-9 md:w-9 rounded-lg hover:bg-muted transition-colors">
                                <MoreVertical className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl border-[3px] p-1.5 shadow-2xl">
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setTimeout(() => {
                                    setEditingPost(post);
                                    setNewTitle(post.title);
                                    setNewContent(post.content);
                                    setNewSubject(post.subject || 'other');
                                  }, 10);
                                }}
                                className="font-black uppercase text-[10px] gap-2 p-2.5 rounded-lg cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" /> {t.edit}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setTimeout(() => setPostToDelete(post), 10);
                                }}
                                className="font-black uppercase text-[10px] gap-2 p-2.5 rounded-lg cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> {t.delete}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>

                    <p className="text-[10px] md:text-base font-bold text-muted-foreground line-clamp-2 leading-relaxed max-w-full">
                      <LatexText text={post.content} />
                    </p>

                    <div className="flex items-center justify-between pt-2 md:pt-4 border-t-2 border-border/30">
                      <span className="text-[7px] md:text-[10px] font-black text-primary uppercase tracking-widest truncate max-w-[80px] md:max-w-[150px]">{post.authorName}</span>
                      <div className="flex items-center gap-2 md:gap-6">
                        <button
                          aria-label={lang === 'vi' ? 'Thích bài viết' : 'Like post'} aria-pressed={post.likedBy?.includes(user?.uid || '') ?? false}
                          onClick={(e) => toggleLike(e, post)}
                          className={cn(
                            "flex items-center gap-1 md:gap-2 group/heart transition-all active:scale-90",
                            post.likedBy?.includes(user?.uid || '') ? "text-red-500" : "text-muted-foreground hover:text-red-500"
                          )}
                        >
                          <Heart className={cn("w-3.5 h-3.5 md:w-5 md:h-5", post.likedBy?.includes(user?.uid || '') && "fill-current")} />
                          <span className="text-[9px] md:text-xs font-black">{post.likesCount}</span>
                        </button>
                        <div className="flex items-center gap-1 md:gap-2 text-muted-foreground">
                          <MessageSquare className="w-3.5 h-3.5 md:w-5 md:h-5" />
                          <span className="text-[9px] md:text-xs font-black">{post.commentsCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editingPost} onOpenChange={(open) => { if (!open && !mutation.isPending()) setEditingPost(null); }}>
        <DialogContent className="max-w-4xl w-[95vw] rounded-[1.5rem] md:rounded-[2.5rem] border-[3px] md:border-[4px] shadow-2xl p-5 md:p-10 bg-card overflow-y-auto max-h-[90vh]"><fieldset disabled={mutation.pending} className="contents">
          <DialogHeader>
            <DialogTitle className="text-xl md:text-3xl font-headline font-black text-primary uppercase tracking-tight text-left">
              {t.edit.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 md:space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t.postTitle}</label>
                  <div className="flex flex-wrap gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => insertLatex('title', 'inline')} className="h-6 px-1.5 text-[8px] font-black bg-muted/50 rounded-md hover:bg-primary/10 transition-all"><UiText id="inlineMath" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => insertLatex('title', 'block')} className="h-6 px-1.5 text-[8px] font-black bg-muted/50 rounded-md hover:bg-primary/10 transition-all"><UiText id="blockMath" /></Button>
                  </div>
                </div>
                <Input
                  className="h-12 md:h-14 rounded-xl md:rounded-2xl border-[2px] md:border-[3px] border-border font-black text-sm bg-muted/10"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                  <BookOpen className="w-3 h-3" /> {t.subjectTag}
                </label>
                <Select value={newSubject} onValueChange={setNewSubject}>
                  <SelectTrigger className="h-12 md:h-14 rounded-xl md:rounded-2xl border-[3px] border-border font-black text-sm bg-muted/10">
                    <SelectValue placeholder={t.selectSubject} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-[3px]">
                    {subjectsList.map(s => (
                      <SelectItem key={s.id} value={s.id} className="font-black uppercase text-[10px] md:text-xs">
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t.postContent}</label>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => insertLatex('content', 'inline')} className="h-6 px-1.5 text-[8px] font-black bg-muted/50 rounded-md hover:bg-primary/10 transition-all"><UiText id="inlineMath" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => insertLatex('content', 'block')} className="h-6 px-1.5 text-[8px] font-black bg-muted/50 rounded-md hover:bg-primary/10 transition-all"><UiText id="blockMath" /></Button>
                </div>
              </div>

              <LatexQuickToolbar onSelect={(s) => insertSnippet('content', s)} />

              <Textarea
                className="min-h-[120px] md:min-h-[200px] rounded-xl md:rounded-2xl border-[2px] md:border-[3px] border-border font-bold text-xs p-4 bg-muted/10"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="ghost" onClick={() => setEditingPost(null)} className="btn-duo flex-1 h-12 md:h-14 rounded-xl font-black uppercase text-[10px] md:text-xs tracking-widest bg-card">{t.cancel}</Button>
              <Button disabled={mutation.pending} onClick={handleUpdatePost} className="btn-duo flex-1 h-12 md:h-14 rounded-xl bg-primary text-white font-black uppercase text-[10px] md:text-xs tracking-widest border-2 md:border-[3px] border-primary/20">{t.update}</Button>
            </div>
          </div>
        </fieldset></DialogContent>
      </Dialog>

      {/* Delete Alert Dialog */}
      <AlertDialog open={!!postToDelete} onOpenChange={(open) => { if (!open && !mutation.isPending()) setPostToDelete(null); }}>
        <AlertDialogContent className="rounded-[1.5rem] md:rounded-[2rem] border-[3px] md:border-[4px] shadow-2xl p-6 md:p-8 max-w-[90vw] md:max-w-md bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl md:text-2xl font-headline font-black text-destructive uppercase tracking-tight">{t.delete.toUpperCase()}?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs md:text-sm font-bold text-muted-foreground leading-relaxed">{t.confirmDelete}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 md:mt-8 flex flex-row gap-3">
            <AlertDialogCancel className="btn-duo flex-1 h-11 md:h-12 rounded-xl font-black uppercase text-[10px] md:text-xs tracking-widest m-0 bg-card">{t.cancel}</AlertDialogCancel>
            <AlertDialogAction disabled={mutation.pending} onClick={handleDeletePost} className="btn-duo flex-1 h-11 md:h-12 rounded-xl bg-destructive text-white font-black uppercase text-[10px] md:text-xs tracking-widest border-2 md:border-[3px] border-destructive/20 m-0 min-w-[80px] flex items-center justify-center px-4 md:px-8">
              {t.delete.toUpperCase()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
