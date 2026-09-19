
"use client";
import { useLanguageState,useThemeState } from '@/components/app-preferences';
import { PageControls } from '@/components/page-controls';
import { UiText } from "@/components/ui-text";
import { usePagedCollection } from '@/hooks/use-paged-collection';
import { formatForumDate } from '@/lib/date-format';
import { readForumPost, readForumComment } from '@/lib/public-firestore-schema';
import { deleteForumPost } from '@/lib/forum-client';
import { uiMessage } from '@/lib/i18n';
import { subjectOptions } from '@/lib/subjects';
import { useMemo } from 'react';

import ActivityCalendar from '@/components/activity-calendar';
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
import { ForumComment,ForumPost } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
arrayRemove,
arrayUnion,
collection,
doc,
increment,
onSnapshot,
orderBy,
query,
serverTimestamp,
updateDoc
} from 'firebase/firestore';
import {
ArrowLeft,
Clock,
Heart,
Loader2,
MessageSquare,
MoreVertical,
Pencil,
Send,
Sigma,
Trash2,
User
} from 'lucide-react';
import { useParams,useRouter } from 'next/navigation';
import { useEffect,useRef,useState } from 'react';

import { LatexQuickToolbar } from '@/components/latex-toolbar';
import { useMutation } from '@/hooks/use-mutation';

export default function PostDetailPage() {
  const { user } = useUser();
  const db = useFirestore();
  const mutation = useMutation();
  const router = useRouter();
  const params = useParams();
  const postId = params.postId as string;
  const { toast } = useToast();

  const [lang, setLang] = useLanguageState();
  const [theme, setTheme] = useThemeState();
  const [post, setPost] = useState<ForumPost | null>(null);

  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const commentRequest = useRef<{ content: string; id: string } | null>(null);
  const postingComment = useRef(false);

  // Edit/Delete States
  const [editingPost, setEditingPost] = useState<ForumPost | null>(null);
  const [editingComment, setEditingComment] = useState<ForumComment | null>(null);
  const [postToDelete, setPostToDelete] = useState<ForumPost | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<ForumComment | null>(null);
  const [tempTitle, setTempTitle] = useState("");
  const [tempContent, setTempContent] = useState("");
  const [tempSubject, setTempSubject] = useState("");

  const { notes: personalNotes, updateNotes: onNotesChange } = useUserNotes();


  useEffect(() => {
    setPost(null);
    setLoading(Boolean(postId && db));
    if (!postId || !db) return;
    let active = true;
    const postRef = doc(db, 'posts', postId);
    const unsubPost = onSnapshot(postRef,
      (docSnap) => {
        if (!active) return;
        const parsed = docSnap.exists() ? readForumPost(docSnap.id, docSnap.data()) : null;
        setPost(parsed);
        if (parsed) {
          setLoading(false);
        } else {
          toast({ variant: "destructive", title: uiMessage(lang, "forum.post_not_found") });
          router.push('/forum');
        }
        setLoading(false);
      },
      async cause => {
        if (!active) return;
        setPost(null);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: postRef.path, operation: 'get' }, cause));
        setLoading(false);
      }
    );

    return () => { active = false; unsubPost(); };
  }, [db, postId, router, toast, lang]);
  const commentSource = useMemo(() => db && post?.id === postId ? query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc')) : null, [db, postId, post?.id]);
  const commentPage = usePagedCollection<ForumComment>(commentSource, readForumComment);
  const comments = commentPage.items;

  const t: TranslationSet = translations[lang];

  const subjectsList = subjectOptions(t);

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

  const handleAddComment = async () => {
    if (!user || !db) {
      toast({ variant: "destructive", title: t.mustLoginToInteract });
      return;
    }
    if (!newComment.trim()) return;
    if (postingComment.current) return;
    postingComment.current = true;
    const content = newComment;
    if (commentRequest.current?.content !== content) commentRequest.current = { content, id: crypto.randomUUID() };

    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/forum/${encodeURIComponent(postId)}/comments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, requestId: commentRequest.current.id }),
      });
      if (!response.ok) throw new Error();
      commentRequest.current = null;
      setNewComment(current => current === content ? '' : current);
      toast({ title: uiMessage(lang, "forum.comment_added") });
    } catch {
      toast({ variant: 'destructive', title: uiMessage(lang, "forum.could_not_add_comment") });
    } finally {
      postingComment.current = false;
    }
  };

  const handleUpdatePost = async () => {
    if (!user || !db || !post) return;
    const postRef = doc(db, 'posts', post.id);
    const updateData = {
      title: tempTitle,
      content: tempContent,
      subject: tempSubject,
      updatedAt: serverTimestamp()
    };

    const result = await mutation.run(() => updateDoc(postRef, updateData), cause => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: postRef.path, operation: 'update', requestResourceData: updateData }, cause));
    });
    if (result.ok) { setEditingPost(null);
        toast({ title: uiMessage(lang, "forum.updated") });

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
        router.push('/forum');

    }
    return result;
  };

  const handleUpdateComment = async () => {
    if (!user || !db || !editingComment) return;
    const commRef = doc(db, 'posts', postId, 'comments', editingComment.id);
    const updateData = { content: tempContent, updatedAt: serverTimestamp() };

    const result = await mutation.run(() => updateDoc(commRef, updateData), cause => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: commRef.path, operation: 'update', requestResourceData: updateData }, cause));
    });
    if (result.ok) { setEditingComment(null);
        toast({ title: uiMessage(lang, "forum.comment_updated") });

    }
    return result;
  };

  const handleDeleteComment = async () => {
    if (!user || !db || !commentToDelete) return;
    setCommentToDelete(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/forum/${encodeURIComponent(postId)}/comments?commentId=${encodeURIComponent(commentToDelete.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error();
      toast({ title: uiMessage(lang, "forum.comment_deleted") });
    } catch {
      toast({ variant: 'destructive', title: uiMessage(lang, "forum.could_not_delete_comment") });
    }
  };

  const togglePostLike = () => {
    if (!user || !post || !db) {
      toast({ variant: "destructive", title: t.mustLoginToInteract });
      return;
    }
    const postRef = doc(db, 'posts', post.id);
    const hasLiked = post.likedBy?.includes(user.uid);
    updateDoc(postRef, {
      likedBy: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      likesCount: increment(hasLiked ? -1 : 1)
    }).catch(async cause => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: postRef.path, operation: 'update', requestResourceData: { likedBy: user.uid } }, cause));
    });
  };

  const toggleCommentLike = (comment: ForumComment) => {
    if (!user || !db) {
      toast({ variant: "destructive", title: t.mustLoginToInteract });
      return;
    }
    const commRef = doc(db, 'posts', postId, 'comments', comment.id);
    const hasLiked = comment.likedBy?.includes(user.uid);
    updateDoc(commRef, {
      likedBy: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      likesCount: increment(hasLiked ? -1 : 1)
    }).catch(async cause => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: commRef.path, operation: 'update', requestResourceData: { likedBy: user.uid } }, cause));
    });
  };

  const insertLatexToComment = (type: 'inline' | 'block') => {
    const wrapper = type === 'inline' ? '$' : '$$';
    setNewComment(prev => prev + wrapper + wrapper);
  };

  const insertLatexToEdit = (type: 'inline' | 'block') => {
    const wrapper = type === 'inline' ? '$' : '$$';
    setTempContent(prev => prev + wrapper + wrapper);
  };

  const insertSnippetToComment = (snippet: string) => {
    setNewComment(prev => prev + `$${snippet}$`);
  };

  const insertSnippetToEdit = (snippet: string) => {
    setTempContent(prev => prev + `$${snippet}$`);
  };




  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  if (!post) return null;

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

      <main className="flex-1 w-full max-w-4xl mx-auto p-3 md:p-8 pt-24 md:pt-36 space-y-6 md:space-y-10 animate-in fade-in duration-700">
      <PageControls lang={lang} {...commentPage} />
        <Button variant="ghost" onClick={() => router.push('/forum')} className="btn-duo h-9 md:h-12 rounded-xl md:rounded-2xl border-[3px] border-transparent hover:border-border font-black uppercase text-[10px] md:text-xs tracking-widest gap-2">
          <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" /> {t.back}
        </Button>

        <Card className="card-duo p-5 md:p-12 space-y-6 md:space-y-8 bg-card border-border/50 shadow-2xl relative">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 border-b-[4px] md:border-b-[5px] border-border/30 pb-6 md:pb-8">
            <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
              <Avatar className="w-12 h-12 md:w-20 md:h-20 rounded-[1.2rem] md:rounded-[2rem] border-2 md:border-4 border-primary/20 shadow-duo shrink-0">
                <AvatarImage src={post.authorPhoto} />
                <AvatarFallback className="bg-primary/10 text-primary font-black text-lg md:text-2xl">{post.authorName[0]}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm md:text-lg font-black text-primary uppercase tracking-wider truncate">{post.authorName}</span>
                  <Badge variant="outline" className={cn("font-black uppercase text-[7px] md:text-[9px] tracking-widest border-2", getSubjectColor(post.subject))}>
                    {getSubjectLabel(post.subject)}
                  </Badge>
                </div>
                <span className="text-[8px] md:text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" /> {formatForumDate(post, lang, t.edited)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 md:gap-6 shrink-0 justify-end">
              {user?.uid === post.authorId && (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 md:h-12 md:w-12 rounded-xl hover:bg-muted">
                      <MoreVertical className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl border-[3px] p-2 shadow-2xl">
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        setTimeout(() => {
                          setEditingPost(post);
                          setTempTitle(post.title);
                          setTempContent(post.content);
                          setTempSubject(post.subject || 'other');
                        }, 10);
                      }}
                      className="font-black uppercase text-xs gap-3 p-3 rounded-lg cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" /> {t.edit}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        setTimeout(() => setPostToDelete(post), 10);
                      }}
                      className="font-black uppercase text-xs gap-3 p-3 rounded-lg cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" /> {t.delete}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <button onClick={togglePostLike} className={cn("flex items-center gap-1.5 md:gap-3 group transition-all active:scale-90", post.likedBy?.includes(user?.uid || '') ? "text-red-500" : "text-muted-foreground hover:text-red-500")}>
                <Heart className={cn("w-5 h-5 md:w-8 md:h-8", post.likedBy?.includes(user?.uid || '') && "fill-current")} />
                <span className="text-base md:text-xl font-black">{post.likesCount}</span>
              </button>
              <div className="flex items-center gap-1.5 md:gap-3 text-muted-foreground"><MessageSquare className="w-5 h-5 md:w-8 md:h-8" /><span className="text-base md:text-xl font-black">{post.commentsCount}</span></div>
            </div>
          </div>

          <div className="space-y-4 md:space-y-6">
            <h1 className="text-xl md:text-5xl font-headline font-black text-foreground uppercase tracking-tight leading-tight whitespace-normal break-words">
              <LatexText text={post.title} />
            </h1>
            <div className="text-sm md:text-xl font-bold text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
              <LatexText text={post.content} />
            </div>
          </div>
        </Card>

        <div className="space-y-6 md:space-y-8">
          <div className="flex items-center gap-3 md:gap-4 border-b-[4px] md:border-b-[5px] border-border/30 pb-3 md:pb-4"><MessageSquare className="w-6 h-6 md:w-8 md:h-8 text-primary" /><h3 className="text-lg md:text-3xl font-headline font-black text-foreground uppercase tracking-tight">{t.comments} ({comments.length})</h3></div>

          <div className="space-y-4 md:space-y-6">
            {comments.length === 0 ? <div className="py-8 md:py-12 text-center text-muted-foreground opacity-50 font-black uppercase tracking-widest italic text-xs md:text-base">{uiMessage(lang, "forum.no_comments_yet")}</div> :
              comments.map((comment) => (
                <Card key={comment.id} className="card-duo p-4 md:p-8 bg-card/50 border-border/30 hover:border-primary/20 transition-all flex gap-3 md:gap-6 relative">
                  <Avatar className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl border-2 border-border shrink-0"><AvatarImage src={comment.authorPhoto} /><AvatarFallback className="bg-primary/10 text-primary font-black text-xs">{comment.authorName[0]}</AvatarFallback></Avatar>
                  <div className="flex-1 space-y-2 md:space-y-3 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] md:text-sm font-black text-primary uppercase tracking-widest truncate">{comment.authorName}</span>
                        <span className="text-[8px] md:text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1"><Clock className="w-2.5 h-2.5 md:w-3 md:h-3" /> {formatForumDate(comment, lang, t.edited)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {user?.uid === comment.authorId && (
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 md:h-9 md:w-9 rounded-lg hover:bg-muted">
                                <MoreVertical className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl border-[3px] p-1.5 shadow-2xl">
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setTimeout(() => {
                                    setEditingComment(comment);
                                    setTempContent(comment.content);
                                  }, 10);
                                }}
                                className="font-black uppercase text-[10px] gap-2 p-2.5 rounded-lg cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" /> {t.edit}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setTimeout(() => setCommentToDelete(comment), 10);
                                }}
                                className="font-black uppercase text-[10px] gap-2 p-2.5 rounded-lg cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> {t.delete}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <button onClick={() => toggleCommentLike(comment)} className={cn("flex items-center gap-1.5 md:gap-2 group transition-all active:scale-90", comment.likedBy?.includes(user?.uid || '') ? "text-red-500" : "text-muted-foreground hover:text-red-500")}>
                          <Heart className={cn("w-3.5 h-3.5 md:w-4 md:h-4", comment.likedBy?.includes(user?.uid || '') && "fill-current")} /><span className="text-[10px] md:text-xs font-black">{comment.likesCount}</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs md:text-lg font-bold text-foreground leading-relaxed break-words">
                      <LatexText text={comment.content} />
                    </p>
                  </div>
                </Card>
              ))
            }
          </div>

          <Card className="card-duo p-5 md:p-8 bg-card border-primary/20 shadow-xl mt-8 md:mt-12 group">
            <div className="flex flex-col gap-4 md:gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 md:gap-3">
                  <Avatar className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl border-2 border-border"><AvatarImage src={user?.photoURL || ''} /><AvatarFallback className="bg-primary/10 text-primary font-black"><User className="w-3 h-3 md:w-4 md:h-4" /></AvatarFallback></Avatar>
                  <span className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground tracking-widest">{user ? t.addComment : t.mustLoginToInteract}</span>
                </div>
                {user && (
                  <div className="flex flex-wrap gap-1.5 md:gap-2">
                    <Button variant="ghost" size="sm" onClick={() => insertLatexToComment('inline')} className="h-7 md:h-8 px-2 md:px-3 text-[9px] md:text-[10px] font-black bg-muted/50 rounded-lg md:rounded-xl hover:bg-primary/10 transition-all"><UiText id="inlineMath" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => insertLatexToComment('block')} className="h-7 md:h-8 px-2 md:px-3 text-[9px] md:text-[10px] font-black bg-muted/50 rounded-lg md:rounded-xl hover:bg-primary/10 transition-all"><UiText id="blockMath" /></Button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {user && <LatexQuickToolbar onSelect={insertSnippetToComment} />}

                <Textarea
                  placeholder={t.addComment}
                  disabled={!user}
                  className="min-h-[80px] md:min-h-[100px] rounded-xl md:rounded-2xl border-[3px] md:border-4 border-border font-bold text-sm md:text-base p-4 md:p-6 focus:ring-8 focus:ring-primary/10 transition-all bg-muted/10"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />

                {newComment.includes('$') && (
                  <div className="p-4 md:p-6 bg-muted/5 rounded-xl md:rounded-2xl border-2 border-dashed border-border/50 animate-in fade-in duration-300">
                    <span className="text-[8px] md:text-[9px] font-black uppercase text-primary/50 block mb-2 md:mb-3">{t.latexPreview}</span>
                    <div className="text-sm md:text-base font-bold leading-relaxed"><LatexText text={newComment} /></div>
                  </div>
                )}

                {user && (
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <p className="text-[8px] md:text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest flex items-center gap-1.5 md:gap-2">
                      <Sigma className="w-2.5 h-2.5 md:w-3 md:h-3" /> {t.latexHelp}
                    </p>
                    <Button onClick={handleAddComment} disabled={!user || !newComment.trim()} className="btn-duo h-11 md:h-14 rounded-xl md:rounded-2xl bg-primary text-white font-black uppercase tracking-widest flex items-center gap-2 md:gap-3 border-[3px] md:border-4 border-primary/20 w-full md:w-fit md:px-12"><Send className="w-4 h-4 md:w-5 md:h-5" /> {t.send}</Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </main>

      {/* Edit Post Dialog */}
      <Dialog open={!!editingPost} onOpenChange={(open) => { if (!open && !mutation.isPending()) setEditingPost(null); }}>
        <DialogContent className="max-w-4xl w-[95vw] rounded-[2rem] border-[4px] shadow-2xl p-6 md:p-10 bg-card"><fieldset disabled={mutation.pending} className="contents">
          <DialogHeader><DialogTitle className="text-2xl font-headline font-black text-primary uppercase tracking-tight">{t.edit.toUpperCase()}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground">{t.postTitle}</label>
                <Input className="h-12 border-[3px] font-black" value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-muted-foreground">{t.subjectTag}</label>
                <Select value={tempSubject} onValueChange={setTempSubject}>
                  <SelectTrigger className="h-12 border-[3px] font-black">
                    <SelectValue placeholder={t.selectSubject} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-[3px]">
                    {subjectsList.map(s => (
                      <SelectItem key={s.id} value={s.id} className="font-black uppercase text-xs">
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase text-muted-foreground">{t.postContent}</label>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => insertLatexToEdit('inline')} className="h-6 text-[8px] font-black"><UiText id="inlineMath" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => insertLatexToEdit('block')} className="h-6 text-[8px] font-black"><UiText id="blockMath" /></Button>
                </div>
              </div>

              <LatexQuickToolbar onSelect={insertSnippetToEdit} />

              <Textarea className="min-h-[150px] border-[3px] font-bold" value={tempContent} onChange={(e) => setTempContent(e.target.value)} />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="ghost" onClick={() => setEditingPost(null)} className="btn-duo flex-1 h-12 rounded-xl font-black uppercase text-xs">{t.cancel}</Button>
              <Button disabled={mutation.pending} onClick={handleUpdatePost} className="btn-duo flex-1 h-12 rounded-xl bg-primary text-white font-black uppercase text-xs">{t.update}</Button>
            </div>
          </div>
        </fieldset></DialogContent>
      </Dialog>

      {/* Edit Comment Dialog */}
      <Dialog open={!!editingComment} onOpenChange={(open) => { if (!open && !mutation.pending) setEditingComment(null); }}>
        <DialogContent className="max-w-3xl w-[95vw] rounded-[2rem] border-[4px] shadow-2xl p-6 md:p-10 bg-card"><fieldset disabled={mutation.pending} className="contents">
          <DialogHeader><DialogTitle className="text-2xl font-headline font-black text-primary uppercase tracking-tight">{t.edit.toUpperCase()}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase text-muted-foreground">{t.comments}</label>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => insertLatexToEdit('inline')} className="h-6 text-[8px] font-black"><UiText id="inlineMath" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => insertLatexToEdit('block')} className="h-6 text-[8px] font-black"><UiText id="blockMath" /></Button>
                </div>
              </div>

              <LatexQuickToolbar onSelect={insertSnippetToEdit} />

              <Textarea className="min-h-[100px] border-[3px] font-bold" value={tempContent} onChange={(e) => setTempContent(e.target.value)} />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="ghost" onClick={() => setEditingComment(null)} className="btn-duo flex-1 h-12 rounded-xl font-black uppercase text-xs">{t.cancel}</Button>
              <Button disabled={mutation.pending} onClick={handleUpdateComment} className="btn-duo flex-1 h-12 rounded-xl bg-primary text-white font-black uppercase text-xs">{t.update}</Button>
            </div>
          </div>
        </fieldset></DialogContent>
      </Dialog>

      {/* Delete Post Alert */}
      <AlertDialog open={!!postToDelete} onOpenChange={(open) => { if (!open && !mutation.isPending()) setPostToDelete(null); }}>
        <AlertDialogContent className="rounded-[2rem] border-[4px] shadow-2xl p-8 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline font-black text-destructive uppercase">{t.delete.toUpperCase()}?</AlertDialogTitle>
            <AlertDialogDescription className="font-bold text-muted-foreground">{t.confirmDelete}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 flex flex-row gap-3">
            <AlertDialogCancel className="btn-duo flex-1 h-12 rounded-xl font-black uppercase text-xs m-0 bg-card">{t.cancel}</AlertDialogCancel>
            <AlertDialogAction disabled={mutation.pending} onClick={handleDeletePost} className="btn-duo flex-1 h-12 rounded-xl bg-destructive text-white font-black uppercase text-xs m-0 min-w-[100px] flex items-center justify-center px-8">{t.delete.toUpperCase()}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Comment Alert */}
      <AlertDialog open={!!commentToDelete} onOpenChange={(open) => !open && setCommentToDelete(null)}>
        <AlertDialogContent className="rounded-[2rem] border-[4px] shadow-2xl p-8 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline font-black text-destructive uppercase">{t.delete.toUpperCase()}?</AlertDialogTitle>
            <AlertDialogDescription className="font-bold text-muted-foreground">{t.confirmDelete}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 flex flex-row gap-3">
            <AlertDialogCancel className="btn-duo flex-1 h-12 rounded-xl font-black uppercase text-xs m-0 bg-card">{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteComment} className="btn-duo flex-1 h-12 rounded-xl bg-destructive text-white font-black uppercase text-xs m-0 min-w-[100px] flex items-center justify-center px-8">{t.delete.toUpperCase()}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
