"use client";
import { useLanguageState } from '@/components/app-preferences';
import { UiText } from "@/components/ui-text";
import { uiMessage } from '@/lib/i18n';

import { FocusTrackerSession, focusRecoveryCopy, type FocusState } from "./focus-tracker-session";
import {
AlertTriangle,
Camera,
Eye,
EyeOff,
Loader2,
Minus,
ScanEye,
UserCheck,
UserX,
X,
Zap,
} from "lucide-react";
import { usePathname } from "next/navigation";
import {
useCallback,
useEffect,
useRef,
useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
translations,
TranslationSet,
} from "@/lib/translations";
import { cn } from "@/lib/utils";

export default function FocusTrackerWidget() {
  const pathname = usePathname();
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register";

  const [lang] = useLanguageState();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [state, setState] = useState<FocusState>({ phase: 'idle', score: 0 });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<FocusTrackerSession | null>(null);
  const isActive = state.phase === 'active';
  const isModelLoading = state.phase === 'starting';
  const focusScore = state.score;
  const status = focusScore > 65 ? 'focused' : focusScore > 15 ? 'unfocused' : 'no-person';
  const copy = focusRecoveryCopy[lang];
  const modelError = state.error ? copy[state.error] : null;
  const t: TranslationSet = translations[lang];

  const stopResources = useCallback(() => {
    sessionRef.current?.stop();
    sessionRef.current = null;
  }, []);

  const stopTracking = useCallback(() => {
    stopResources();
    setState({ phase: 'idle', score: 0 });
  }, [stopResources]);

  useEffect(() => () => stopResources(), [stopResources]);

  useEffect(() => {
    if (isAuthPage) {
      stopTracking();
      setIsOpen(false);
    }
  }, [isAuthPage, stopTracking]);

  const toggleTracking = () => {
    if (isActive || isModelLoading) {
      stopTracking();
      return;
    }
    stopResources();
    const session = new FocusTrackerSession(next => {
      if (sessionRef.current === session) setState(next);
    });
    sessionRef.current = session;
    void session.start();
  };

  // Minimization detaches playback/inference; expanding binds the retained stream again.
  useEffect(() => {
    if (isActive && isOpen && !isMinimized && videoRef.current) {
      return sessionRef.current?.attach(videoRef.current);
    }
  }, [isActive, isOpen, isMinimized]);

  if (isAuthPage) return null;

  return (
    <div className={cn(
      "fixed z-[200] flex flex-col gap-4 pointer-events-none transition-all duration-500",
      isOpen && isMinimized
        ? "bottom-24 left-4 md:bottom-32 md:left-6 items-start"
        : "bottom-24 right-4 md:bottom-32 md:right-6 items-end"
    )}>
      {isOpen && !isMinimized && (
        <Card className="card-duo w-[300px] md:w-[350px] overflow-hidden animate-in slide-in-from-bottom-8 duration-500 pointer-events-auto border-[3px] shadow-2xl bg-card mb-2">
          <div className="bg-primary p-4 flex items-center justify-between text-white border-b-4 border-black/10">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 fill-current animate-pulse" />
              <span className="font-headline font-black uppercase text-sm tracking-widest">{t.focusShield}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label={uiMessage(lang, 'focus.minimize')} onClick={() => setIsMinimized(true)} className="h-8 w-8 rounded-lg hover:bg-white/20 text-white"><Minus className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon" aria-label={uiMessage(lang, "focus.stop_camera_and_close")} onClick={() => { setIsOpen(false); stopTracking(); }} className="h-8 w-8 rounded-lg hover:bg-white/20 text-white"><X className="w-5 h-5" /></Button>
            </div>
          </div>

          <div className="p-5 space-y-6">
            <div className={cn("relative aspect-video bg-muted rounded-2xl border-4 border-border overflow-hidden transition-all duration-500", !showPreview && "h-0 opacity-0 mb-[-1.5rem]")}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              {!isActive && !modelError && !isModelLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs text-white text-center p-4">
                  <Camera className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-relaxed">{t.systemReady}</p>
                </div>
              )}
              {isModelLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-primary/20 backdrop-blur-md">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
              )}
            </div>

            {modelError && (
              <div role="alert" className="rounded-xl border-2 border-destructive/30 p-3 text-destructive">
                <AlertTriangle className="mb-2 h-5 w-5" />
                <p className="text-sm">{modelError}</p>
                <Button variant="outline" size="sm" onClick={toggleTracking} className="mt-3">{copy.retry}</Button>
              </div>
            )}
            {isModelLoading && <p role="status" className="text-sm">{copy.starting}</p>}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t.trackingMode}</span>
                  <span className="text-xs font-bold">{isActive ? t.aiMonitorActive : t.systemPaused}</span>
                </div>
                <Switch aria-label={t.trackingMode} checked={isActive || isModelLoading} onCheckedChange={toggleTracking} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={cn("p-3 rounded-xl border-2 flex flex-col gap-1 transition-all", status === 'focused' ? "bg-green-50 border-green-200 text-green-700" : "bg-muted border-border opacity-50")}>
                  <UserCheck className="w-4 h-4" />
                  <span className="text-[8px] font-black uppercase tracking-widest">{t.focusedStatus}</span>
                </div>
                <div className={cn("p-3 rounded-xl border-2 flex flex-col gap-1 transition-all", status !== 'focused' && isActive ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-muted border-border opacity-50")}>
                  <UserX className="w-4 h-4" />
                  <span className="text-[8px] font-black uppercase tracking-widest">{t.distractedStatus}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <span><UiText id="focusIndex" /></span>
                  <span className="text-primary">{focusScore}%</span>
                </div>
                <Progress value={focusScore} className="h-3 border-2" />
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="w-full rounded-xl font-black uppercase text-[9px] tracking-widest h-10 border-2 bg-card">
              {showPreview ? <EyeOff className="w-3.5 h-3.5 mr-2" /> : <Eye className="w-3.5 h-3.5 mr-2" />}
              {showPreview ? t.hideCam : t.showCam}
            </Button>
          </div>
        </Card>
      )}

      {(!isOpen || isMinimized) && (
        <Button
          aria-label={t.focusShield}
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className={cn(
            "h-14 w-14 md:h-20 md:w-20 rounded-2xl md:rounded-[2rem] shadow-duo btn-duo pointer-events-auto transition-all bg-card border-[3px] border-border group",
            isActive && status === 'focused' ? "border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)]" : isActive ? "border-amber-500" : ""
          )}
        >
          <div className="relative">
            {modelError ? (
              <AlertTriangle className="w-7 h-7 md:w-10 md:h-10 text-destructive animate-pulse" />
            ) : (
              <ScanEye className={cn("w-7 h-7 md:w-10 md:h-10 text-primary transition-transform group-hover:scale-110", isActive && "animate-pulse")} />
            )}
            {isActive && !modelError && (
              <div className={cn("absolute -top-1 -right-1 w-3 h-3 md:w-4 md:h-4 rounded-full border-2 border-white", status === 'focused' ? "bg-green-500" : "bg-amber-500")} />
            )}
          </div>
        </Button>
      )}
    </div>
  );
}
