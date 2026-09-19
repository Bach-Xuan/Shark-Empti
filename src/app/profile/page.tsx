'use client';
import { PageControls } from '@/components/page-controls';
import { ProfilePrintReport } from '@/components/profile-print-report';
import { ReportSelectionRow } from '@/components/report-selection-row';
import { useProfileReport } from '@/hooks/use-profile-report';


import { useLanguageState,useThemeState } from '@/components/app-preferences';
import { copyTextToClipboard } from '@/lib/clipboard';
import { formatStoredDate } from '@/lib/date-format';
import { showUnexpectedErrorToast } from '@/lib/error-toast';
import { uiMessage } from '@/lib/i18n';
import { readLearnerProfile,type LearnerProfile } from '@/lib/profile-schema';

import { LatexText } from '@/components/latex-text';
import Navigation from '@/components/navigation';
import { Avatar,AvatarFallback,AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card,CardContent } from '@/components/ui/card';
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { useAuth,useDoc,useFirestore,useUser } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { translations,TranslationSet } from '@/lib/translations';
import { cn } from '@/lib/utils';
import { signOut } from 'firebase/auth';
import {
doc,
getDoc,
serverTimestamp,
updateDoc
} from 'firebase/firestore';
import {
AlertCircle,
ArrowRight,
BrainCircuit,
CalendarDays,
Check,
CheckCircle2,
Circle,
Clock,
Copy,
Download,
FileText,
Filter,
Fingerprint,
Loader2,
LogOut,
Mail,
Save,
Search,
Sparkles,
User as UserIcon,
X
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect,useMemo,useRef,useState } from 'react';

export default function ProfilePage() {
  const { user, loading: authLoading } = useUser();
  const { data: profileData, loading: profileLoading } = useDoc(user ? `users/${user.uid}` : null);
  const profile = useMemo(() => readLearnerProfile(profileData), [profileData]);
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [lang, setLang] = useLanguageState();
  const [theme, setTheme] = useThemeState();
  const [bio, setBio] = useState('');
  const bioDirty = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const t: TranslationSet = translations[lang];
  const { historyPage, history, isReportSelectOpen, setIsReportSelectOpen, isReportViewOpen, setIsReportViewOpen, selectedSessionIds, setSelectedSessionIds, roadmapStatus, reportSearchQuery, setReportSearchQuery, reportSortOrder, setReportSortOrder, reportStats, filteredReportHistory } = useProfileReport(user, t, lang);

  // Search States
  const [searchUid, setSearchUid] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<LearnerProfile | null>(null);
  const searching = useRef(false);
  const savingBio = useRef(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  useEffect(() => {
if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router, setLang, setTheme]);

  useEffect(() => {
    if (!bioDirty.current) {
      setBio(profile?.bio ?? '');
    }
  }, [profile]);

  // Fetch History for Report


  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch {
      showUnexpectedErrorToast('APP-AUTH-SIGNOUT-FAILED', 'Sign out failed.', {}, lang);
    }
  };

  const handleSaveBio = async () => {
    if (!user || savingBio.current) return;
    savingBio.current = true;
    setIsSaving(true);

    const userRef = doc(firestore, 'users', user.uid);
    await updateDoc(userRef, {
      bio,
      updatedAt: serverTimestamp()
    })
    .then(() => {
      bioDirty.current = false;
      toast({
        title: uiMessage(lang, "profile.updated"),
        description: uiMessage(lang, "profile.your_profile_has_been_saved_successfully"),
      });
    })
    .catch(async (error) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: userRef.path,
        operation: 'update',
        requestResourceData: { bio },
      }, error));
    })
    .finally(() => {
      savingBio.current = false;
      setIsSaving(false);
    });
  };

  const handleSearchUser = async () => {
    if (searching.current) return;
    const targetUid = searchUid.trim();
    if (!targetUid) {
      toast({
        variant: "destructive",
        title: uiMessage(lang, "profile.uid_missing"),
        description: uiMessage(lang, "profile.please_enter_a_uid_to_search"),
      });
      return;
    }

    searching.current = true;
    setSearchResult(null);
    setIsSearching(true);
    try {
      const userDocRef = doc(firestore, 'users', targetUid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        setSearchResult(readLearnerProfile(userDoc.data()));
        setIsSearchModalOpen(true);
      } else {
        toast({
          variant: "destructive",
          title: uiMessage(lang, "profile.not_found"),
          description: uiMessage(lang, "profile.no_user_found_with_this_uid"),
        });
      }
    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: `users/${targetUid}`, operation: 'get',
      }, error));
    } finally {
      searching.current = false;
      setIsSearching(false);
    }
  };

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessionIds(prev =>
      prev.includes(sessionId) ? prev.filter(id => id !== sessionId) : [...prev, sessionId]
    );
  };

  const handleGenerateReport = () => {
    if (selectedSessionIds.length === 0) {
      toast({
        variant: "destructive",
        title: t.noTopicsSelected,
      });
      return;
    }
    setIsReportSelectOpen(false);
    setIsReportViewOpen(true);
  };

  const handlePrintReport = () => {
    window.print();
  };

  const copyReportToClipboard = async () => {
    const reportEl = document.getElementById('report-content');
    if (reportEl) {
      const text = reportEl.innerText;
      if (await copyTextToClipboard(text)) {
        toast({ title: t.copied });
      } else toast({ variant: 'destructive', title: uiMessage(lang, 'quicknotes.could_not_copy_please_try_again') });
    }
  };

  const copyToClipboard = async () => {
    if (user?.uid) {
      if (!await copyTextToClipboard(user.uid)) {
        toast({ variant: 'destructive', title: uiMessage(lang, 'quicknotes.could_not_copy_please_try_again') });
        return;
      }
      setIsCopied(true);
      toast({
        title: uiMessage(lang, "profile.copied"),
        description: uiMessage(lang, "profile.uid_has_been_saved_to_clipboard"),
      });
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const onThemeChange = (isDark: boolean) => {
    const newTheme = isDark ? 'dark' : 'light';
    setTheme(newTheme);


  };

  const creationDate = user?.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : '---';

  const formatSessionDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const searchMemberSince = searchResult?.createdAt
    ? formatStoredDate(searchResult.createdAt, lang, { day: 'numeric', month: 'long', year: 'numeric' }) : '---';

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background transition-colors duration-500">
      <Navigation
        view="profile"
        setView={(v) => {
          if (v === 'setup') router.push('/');
          else if (v === 'dashboard') router.push('/?view=dashboard');
          else if (v === 'playground') router.push('/?view=playground');
        }}
        lang={lang}
        changeLang={(l) => {
          setLang(l);

        }}
        theme={theme}
        onThemeChange={(isDark) => onThemeChange(isDark)}
        t={t}
      />

      <main className="flex-1 main-container pt-24 md:pt-36 space-y-8 pb-20">
      <PageControls lang={lang} {...historyPage} />
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-headline font-black text-primary uppercase tracking-tighter">
            {uiMessage(lang, "profile.academic_profile")}
          </h1>
        </div>

        <Card className="card-duo overflow-hidden bg-card hover:translate-y-[-8px]">
          <div className="bg-primary/5 p-8 md:p-12 border-b-[4px] border-border flex flex-col items-center gap-6">
            <div className="relative">
              <Avatar className="w-32 h-32 md:w-40 md:h-40 border-[6px] border-background shadow-duo rounded-[3rem] transition-transform">
                <AvatarImage src={user.photoURL || ''} />
                <AvatarFallback className="bg-primary/10 text-primary text-4xl font-black">
                  {user.email?.[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="text-center space-y-4">
              <h2 className="text-3xl md:text-4xl font-headline font-black text-foreground uppercase tracking-tight">
                {user.displayName}
              </h2>
              <div className="flex flex-col items-center gap-3">
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <div className="flex items-center gap-2 bg-muted/50 px-4 py-1.5 rounded-full border-2 border-border/50 shadow-xs">
                    <Mail className="w-4 h-4 text-primary" />
                    <span className="text-xs md:sm font-bold text-muted-foreground">{user.email}</span>
                  </div>

                  <div className="flex items-center gap-2 bg-muted/30 px-4 py-1.5 rounded-full border-2 border-border/50 shadow-xs">
                    <CalendarDays className="w-4 h-4 text-primary" />
                    <span className="text-xs md:sm font-bold text-muted-foreground">{t.memberSince}: {creationDate}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-2xl border-4 border-border shadow-duo group transition-all hover:border-primary/50 active:translate-y-1 active:shadow-none">
                  <Fingerprint className="w-4 h-4 text-primary opacity-70" />
                  <span className="text-[10px] md:xs font-black text-muted-foreground tracking-widest uppercase truncate max-w-[150px] md:max-w-none">
                    UID: {user.uid}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyToClipboard}
                    className="h-8 w-8 rounded-xl hover:bg-muted text-primary transition-all active:scale-90"
                    title={t.copyUid}
                  >
                    {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <CardContent className="p-8 md:p-12 space-y-10">
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] md:xs font-black uppercase text-muted-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  {uiMessage(lang, "profile.my_bio_notes")}
                </label>
                <Textarea
                  className="min-h-[120px] rounded-2xl border-4 border-border bg-muted/20 font-bold p-6 focus:ring-8 focus:ring-primary/10 focus:border-primary transition-all shadow-inner text-base"
                  placeholder={uiMessage(lang, "profile.tell_shark_guru_about_yourself")}
                  value={bio}
                  disabled={isSaving} onChange={(e) => { bioDirty.current = true; setBio(e.target.value); }}
                />

                <Button
                  onClick={handleSaveBio}
                  disabled={isSaving}
                  className="w-full h-14 rounded-2xl btn-duo bg-primary text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 border-4 border-primary/20"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {uiMessage(lang, "profile.save_bio")}
                </Button>
              </div>

              <div className="pt-4 border-t-4 border-dashed border-border/50">
                <Button
                  onClick={() => setIsReportSelectOpen(true)}
                  disabled={history.length === 0}
                  className="w-full h-16 rounded-2xl btn-duo bg-card text-primary font-black text-base md:lg uppercase tracking-[0.2em] flex items-center justify-center gap-4 border-4 border-primary/30 hover:bg-primary/5 group"
                >
                  <FileText className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  {t.exportReport}
                </Button>
                {history.length === 0 && (
                   <p className="text-center text-[10px] font-black uppercase text-muted-foreground mt-3 opacity-60">
                     {t.noHistory}
                   </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-duo p-6 md:p-8 bg-card hover:translate-y-[-4px]">
          <div className="space-y-4">
            <label className="text-[10px] md:xs font-black uppercase text-muted-foreground flex items-center gap-3 tracking-[0.2em]">
              <Search className="w-5 h-5 text-primary" />
              {uiMessage(lang, "profile.search_learner_by_uid")}
            </label>
            <div className="flex flex-col md:flex-row gap-4">
              <Input
                placeholder={uiMessage(lang, "profile.enter_user_uid")}
                value={searchUid}
                onChange={(e) => setSearchUid(e.target.value)}
                className="h-14 rounded-2xl border-4 border-border bg-muted/20 font-bold px-6 focus:ring-8 focus:ring-primary/10 focus:border-primary transition-all shadow-inner text-base flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
              />
              <Button
                onClick={handleSearchUser}
                disabled={isSearching}
                className="h-14 rounded-2xl btn-duo bg-card text-foreground font-black text-xs uppercase tracking-widest px-8 border-4 border-border flex items-center gap-3 shrink-0"
              >
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                {uiMessage(lang, "profile.find")}
              </Button>
            </div>
          </div>
        </Card>

        <div className="flex justify-center pt-8">
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="h-16 rounded-2xl btn-duo border-4 border-destructive/20 text-destructive font-black text-base md:lg uppercase tracking-wider flex items-center justify-center gap-3 px-12 hover:bg-destructive/5"
          >
            <LogOut className="w-6 h-6" />
            {uiMessage(lang, "profile.sign_out")}
          </Button>
        </div>
      </main>

      {/* Report Selection Dialog */}
      <Dialog open={isReportSelectOpen} onOpenChange={setIsReportSelectOpen}>
        <DialogContent className="max-w-3xl w-[95vw] rounded-[2.5rem] border-[4px] shadow-2xl p-6 md:p-10 bg-card overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0 mb-4">
            <DialogTitle className="text-2xl md:text-3xl font-headline font-black text-primary uppercase tracking-tight flex items-center gap-3">
              <FileText className="w-8 h-8" /> {t.selectSessions}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 flex-1 flex flex-col min-h-0">
            {/* Filter & Search Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder={t.searchSessions}
                  value={reportSearchQuery}
                  onChange={(e) => setReportSearchQuery(e.target.value)}
                  className="h-12 pl-10 rounded-xl border-2 border-border focus:ring-4 focus:ring-primary/5 transition-all bg-muted/10 font-bold"
                />
              </div>
              <div className="flex items-center gap-3">
                <Filter className="w-4 h-4 text-primary shrink-0" />
                <Select value={reportSortOrder} onValueChange={value => { if (value === 'recent' || value === 'alphabetical') setReportSortOrder(value); }}>
                  <SelectTrigger className="h-12 rounded-xl border-2 border-border font-black text-[10px] md:text-xs uppercase tracking-widest bg-muted/10">
                    <SelectValue placeholder={t.sortBy} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-2 shadow-2xl">
                    <SelectItem value="recent" className="font-black uppercase text-[10px]">{t.recent?.toUpperCase()}</SelectItem>
                    <SelectItem value="alphabetical" className="font-black uppercase text-[10px]">{t.alphabetical?.toUpperCase()}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ScrollArea className="flex-1 border-4 border-border rounded-3xl p-4 bg-muted/5 shadow-inner">
              <div className="grid grid-cols-1 gap-3">
                {filteredReportHistory.map((item) => {
                  const topic = lang === 'vi' ? (item.config.topicVi || item.config.topic) : (item.config.topicEn || item.config.topic);
                  const isSelected = selectedSessionIds.includes(item.id!);

                  return (
                    <ReportSelectionRow
                      key={item.id}
                      checked={isSelected}
                      onToggle={() => toggleSessionSelection(item.id!)}
                      label={`${topic} — ${formatSessionDate(item.date)}`}
                      className={cn(
                        "flex items-center gap-4 p-4 md:p-6 rounded-2xl border-2 transition-all cursor-pointer group/item",
                        isSelected ? "bg-primary/10 border-primary shadow-xs translate-x-1" : "bg-card border-border/50 hover:border-primary/30 hover:translate-x-0.5"
                      )}
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <span className="font-black text-xs md:text-xl uppercase tracking-tight block truncate text-foreground group-hover/item:text-primary transition-colors">
                          <LatexText text={topic} />
                        </span>
                        <div className="flex items-center gap-3 text-muted-foreground/60">
                           <div className="flex items-center gap-1.5 text-[8px] md:text-10px font-black uppercase tracking-widest">
                             <Clock className="w-3 h-3" />
                             {formatSessionDate(item.date)}
                           </div>
                           <div className="flex items-center gap-1.5 text-[8px] md:text-10px font-black uppercase tracking-widest text-primary/70">
                             <CheckCircle2 className="w-3 h-3" />
                             {item.quizResults.filter(r => r.isCorrect).length}/{item.quizResults.length}
                           </div>
                        </div>
                      </div>
                    </ReportSelectionRow>
                  );
                })}
                {filteredReportHistory.length === 0 && (
                  <div className="text-center py-20 opacity-40 flex flex-col items-center gap-4">
                    <Search className="w-12 h-12" />
                    <p className="font-black uppercase tracking-widest text-xs md:text-sm">{t.noHistory}</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex flex-col sm:flex-row gap-4 pt-4 shrink-0">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/80 px-2 flex-1">
                {selectedSessionIds.length} {uiMessage(lang, "profile.items_selected")}
              </div>
              <div className="flex gap-4">
                <Button variant="ghost" onClick={() => setIsReportSelectOpen(false)} className="btn-duo h-14 px-8 rounded-xl font-black uppercase text-xs tracking-widest bg-card">{t.cancel}</Button>
                <Button
                  onClick={handleGenerateReport}
                  disabled={selectedSessionIds.length === 0}
                  className="btn-duo min-w-[200px] h-14 rounded-xl bg-primary text-white font-black uppercase text-xs tracking-widest border-4 border-primary/20 shadow-duo"
                >
                  {t.generateReport} <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report View Dialog */}
      {isReportViewOpen && reportStats && <ProfilePrintReport
        stats={reportStats} roadmapStatus={roadmapStatus} name={user.displayName ?? ''}
        issued={new Date().toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
        t={t} lang={lang}
      />}
      <Dialog open={isReportViewOpen} onOpenChange={setIsReportViewOpen}>
        <DialogContent className="max-w-5xl w-[95vw] rounded-[2.5rem] border-[4px] shadow-2xl p-0 overflow-hidden bg-background">
          <div className="flex items-center justify-between p-6 md:p-8 bg-card border-b-4 border-border shrink-0">
            <DialogTitle className="text-xl md:text-3xl font-headline font-black text-primary uppercase tracking-tight flex items-center gap-4">
              <FileText className="w-8 h-8" /> {t.academicReport}
            </DialogTitle>
            <div className="flex gap-2 md:gap-4 no-print">
              <Button variant="outline" size="icon" aria-label={t.copy} onClick={copyReportToClipboard} className="h-12 w-12 rounded-xl border-2 hover:bg-primary/10 hover:border-primary/30 transition-all"><Copy className="w-5 h-5 text-primary" /></Button>
              <Button variant="outline" size="icon" aria-label={t.printReport} onClick={handlePrintReport} className="h-12 w-12 rounded-xl border-2 hover:bg-primary/10 hover:border-primary/30 transition-all"><Download className="w-5 h-5 text-primary" /></Button>
              <Button variant="ghost" size="icon" aria-label={t.back} onClick={() => setIsReportViewOpen(false)} className="h-12 w-12 rounded-xl border-2"><X className="w-5 h-5" /></Button>
            </div>
          </div>

          <ScrollArea className="h-[80vh] p-6 md:p-12" id="report-content">
            <div className="space-y-12 max-w-4xl mx-auto bg-white dark:bg-card p-6 md:p-16 rounded-[2rem] border-2 border-border shadow-inner">
              <div className="text-center space-y-6 border-b-4 border-primary/10 pb-10">
                <div className="inline-flex p-4 bg-primary/10 rounded-2xl border-2 border-primary/20 mb-2">
                   <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-3xl md:text-5xl font-headline font-black text-primary uppercase tracking-tighter">{t.academicReport}</h2>
                <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-12">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t.reportFor}</span>
                    <span className="text-xl font-bold">{user.displayName}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{uiMessage(lang, "profile.date_issued")}</span>
                    <span className="text-xl font-bold">{new Date().toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>

              {reportStats?.processedGroupedInsights.map((group, i) => {
                const topicChecks = roadmapStatus[group.topicId] || {};
                const completedRecs = group.recommendations.filter(rec => !!topicChecks[rec.id]);
                const pendingRecs = group.recommendations.filter(rec => !topicChecks[rec.id]);

                return (
                  <div key={group.topicId} className="space-y-8 animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${i * 150}ms` }}>
                    <div className="flex items-center gap-4 border-l-8 border-primary pl-6">
                       <h3 className="text-2xl md:text-4xl font-headline font-black uppercase tracking-tight"><LatexText text={group.topic} /></h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <Card className="card-duo p-6 md:p-8 bg-green-500/5 border-green-500/20 shadow-none">
                          <h4 className="text-sm md:lg font-black text-green-700 uppercase tracking-widest flex items-center gap-2 mb-4">
                            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 stroke-[3px] shrink-0 mt-0.5" /> {t.strengths}
                          </h4>
                          <ul className="space-y-3">
                            {group.strengths.map((s, idx) => (
                              <li key={idx} className="text-sm md:base font-bold italic leading-relaxed flex gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 mt-2" />
                                <LatexText text={s} />
                              </li>
                            ))}
                          </ul>
                       </Card>

                       <Card className="card-duo p-6 md:p-8 bg-red-500/5 border-red-500/20 shadow-none">
                          <h4 className="text-sm md:lg font-black text-red-700 uppercase tracking-widest flex items-center gap-2 mb-4">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" /> {t.weaknesses}
                          </h4>
                          <ul className="space-y-3">
                            {group.weaknesses.map((w, idx) => (
                              <li key={idx} className="text-sm md:base font-bold italic leading-relaxed flex gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-2" />
                                <LatexText text={w} />
                              </li>
                            ))}
                          </ul>
                       </Card>
                    </div>

                    <div className="space-y-6">
                       <h4 className="text-sm md:lg font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2 pl-2">
                         <BrainCircuit className="w-6 h-6" /> {t.recommendations}
                       </h4>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-3">
                            <span className="text-[10px] font-black uppercase text-green-600 tracking-widest px-2">{t.completedTasks}</span>
                            {completedRecs.length > 0 ? completedRecs.map(r => (
                              <div key={r.id} className="flex items-start gap-3 p-4 rounded-xl bg-muted/10 border-2 border-green-500/20 opacity-70">
                                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 stroke-[3.5px] shrink-0 mt-0.5" />
                                <p className="text-xs md:sm font-bold line-through"><LatexText text={r.text} /></p>
                              </div>
                            )) : <p className="text-xs italic opacity-40 px-2">---</p>}
                         </div>

                         <div className="space-y-3">
                            <span className="text-[10px] font-black uppercase text-orange-600 tracking-widest px-2">{t.pendingTasks}</span>
                            {pendingRecs.length > 0 ? pendingRecs.map(r => (
                              <div key={r.id} className="flex items-start gap-3 p-4 rounded-xl bg-card border-2 border-orange-500/10 shadow-xs">
                                <Circle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                                <p className="text-xs md:sm font-bold"><LatexText text={r.text} /></p>
                              </div>
                            )) : <p className="text-xs italic opacity-40 px-2">---</p>}
                         </div>
                       </div>
                    </div>
                  </div>
                );
              })}
              {reportStats?.processedGroupedInsights.length === 0 && (
                <div className="text-center py-20 italic opacity-50">
                  {t.noHistory}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isSearchModalOpen} onOpenChange={setIsSearchModalOpen}>
        <DialogContent className="max-w-2xl w-[95vw] rounded-[2.5rem] border-[4px] border-border shadow-2xl p-0 overflow-hidden bg-background/80 backdrop-blur-2xl animate-in zoom-in-95 duration-300">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {uiMessage(lang, "profile.learner_profile")}
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <div className="bg-primary h-32 w-full opacity-10" />
            <div className="px-8 pb-12 -mt-16 flex flex-col items-center gap-6">
              <Avatar className="w-32 h-32 md:w-40 md:h-40 border-[8px] border-background shadow-2xl rounded-[3rem]">
                <AvatarImage src={searchResult?.photoURL || ''} />
                <AvatarFallback className="bg-primary/10 text-primary text-4xl font-black">
                  {searchResult?.displayName?.[0]?.toUpperCase() || <UserIcon className="w-16 h-16" />}
                </AvatarFallback>
              </Avatar>

              <div className="text-center space-y-2">
                <h3 className="text-3xl md:text-5xl font-headline font-black text-primary uppercase tracking-tight">
                  {searchResult?.displayName || uiMessage(lang, 'profile.learner')}
                </h3>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-[10px] md:xs font-black text-muted-foreground uppercase tracking-widest">
                    {uiMessage(lang, "profile.learner")}
                  </p>
                  <div className="flex items-center gap-2 bg-muted/40 px-3 py-1 rounded-full border border-border/50">
                    <CalendarDays className="w-3 h-3 text-primary/70" />
                    <span className="text-[9px] md:text-10px font-bold text-muted-foreground">
                      {t.memberSince}: {searchMemberSince}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full space-y-4">
                <div className="flex items-center gap-3 text-[10px] md:xs font-black uppercase text-muted-foreground tracking-widest px-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  {uiMessage(lang, "profile.learner_bio")}
                </div>
                <div className="min-h-[100px] p-8 rounded-3xl bg-muted/30 border-4 border-border font-bold text-lg italic leading-relaxed shadow-inner">
                  {searchResult?.bio || (uiMessage(lang, "profile.this_learner_has_not_shared_a_bio"))}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
