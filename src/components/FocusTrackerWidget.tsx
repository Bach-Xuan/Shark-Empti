"use client";

/**
 * @fileOverview Tính năng Lá Chắn Tập Trung (Focus Shield) - v1.15.0
 * 
 * FIX v1.15.0 (khôi phục vòng lặp AI sau khi minimize):
 *   Bổ sung isOpen và isMinimized vào danh sách dependency của useEffect
 *   chạy startDetection. Điều này đảm bảo khi người dùng mở rộng widget 
 *   (thẻ video được mount lại), logic nhận diện sẽ tự động khởi động lại
 *   thay vì bị ngắt vĩnh viễn do ref bị null lúc thu nhỏ.
 * 
 * FIX trước đó:
 *   Sử dụng onloadedmetadata để gọi play() an toàn, tránh race condition.
 *   Chuẩn hóa pixel về [-1, 1] khớp MobileNetV2 preprocess_input.
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { usePathname } from "next/navigation";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import {
  ScanEye,
  X,
  Zap,
  UserCheck,
  UserX,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
  Minus,
  Camera,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  translations,
  TranslationSet,
} from "@/lib/translations";
import { Language } from "@/lib/types";

const MODEL_URL = "/models/focus-model/model.json";
const MODEL_INPUT_SIZE = 224;

type FocusStatus =
  | "focused"
  | "unfocused"
  | "no-person"
  | "error";

export default function FocusTrackerWidget() {
  const pathname = usePathname();
  const { toast } = useToast();

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register";

  const [lang, setLang] = useState<Language>("en");
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [focusScore, setFocusScore] = useState(0);
  const [status, setStatus] = useState<FocusStatus>("unfocused");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const modelRef = useRef<tf.LayersModel | tf.GraphModel | null>(null);
  const requestRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastProcessingTime = useRef(0);

  // Sync language
  useEffect(() => {
    const savedLanguage = localStorage.getItem("shark_lang") as Language;
    if (savedLanguage) setLang(savedLanguage);

    const handleLanguageChange = (event: CustomEvent) => {
      if (event.detail) setLang(event.detail);
    };

    window.addEventListener("shark-lang-changed", handleLanguageChange as EventListener);
    return () => {
      window.removeEventListener("shark-lang-changed", handleLanguageChange as EventListener);
    };
  }, []);

  const t: TranslationSet = translations[lang];

  const stopResources = useCallback(() => {
    if (requestRef.current !== null) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.onloadedmetadata = null;
      videoRef.current.srcObject = null;
    }
  }, []);

  // Auto stop on auth pages
  useEffect(() => {
    if (isAuthPage) {
      setIsActive(false);
      setIsOpen(false);
      stopResources();
    }
  }, [isAuthPage, stopResources]);

  const loadModel = async () => {
    if (modelRef.current) return modelRef.current;

    setIsModelLoading(true);
    setModelError(null);

    try {
      await tf.ready();
      try {
        await tf.setBackend('webgl');
      } catch (e) {
        await tf.setBackend('cpu');
      }

      let model: tf.LayersModel | tf.GraphModel | null = null;

      // Try load as LayersModel first (Standard Keras)
      try {
        model = await tf.loadLayersModel(MODEL_URL);
      } catch (err) {
        console.warn("LayersModel failed, trying GraphModel fallback...");
        model = await tf.loadGraphModel(MODEL_URL);
      }

      if (!model) throw new Error("Mô hình không thể khởi tạo");
      modelRef.current = model;

      // Warm up model
      tf.tidy(() => {
        const dummyInput = tf.zeros([1, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 3]);
        if (model instanceof tf.LayersModel) {
          model.predict(dummyInput);
        } else {
          (model as tf.GraphModel).execute(dummyInput);
        }
      });

      return model;
    } catch (error: any) {
      console.error("Focus model error:", error);
      setModelError(lang === "vi" 
        ? "Lỗi mô hình AI (model.json). Vui lòng kiểm tra file." 
        : "AI model error (model.json). Please check files.");
      return null;
    } finally {
      setIsModelLoading(false);
    }
  };

  const startDetection = useCallback(() => {
    const processFrame = async (timestamp: number) => {
      if (!isActive || !videoRef.current || !modelRef.current) return;

      // Throttle to 800ms
      if (timestamp - lastProcessingTime.current < 800) {
        requestRef.current = requestAnimationFrame(processFrame);
        return;
      }
      lastProcessingTime.current = timestamp;

      try {
        if (videoRef.current.readyState < 2) {
          requestRef.current = requestAnimationFrame(processFrame);
          return;
        }

        const score = tf.tidy(() => {
          const pixels = tf.browser.fromPixels(videoRef.current!);
          const resized = tf.image.resizeBilinear(pixels, [MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);

          // IMPORTANT: Scaled to [-1, 1] for MobileNetV2 compatibility
          const normalized = resized
            .toFloat()
            .div(tf.scalar(127.5))
            .sub(tf.scalar(1))
            .expandDims(0);

          let prediction;
          if (modelRef.current instanceof tf.LayersModel) {
            prediction = modelRef.current.predict(normalized) as tf.Tensor;
          } else {
            prediction = (modelRef.current as tf.GraphModel).execute(normalized) as tf.Tensor;
          }

          const data = prediction.dataSync();
          // Assuming output[0] is the focus probability
          return Math.max(0, Math.min(100, Math.round(data[0] * 100)));
        });

        setFocusScore(score);

        // Logic based on training classes
        if (score > 65) setStatus("focused");
        else if (score > 15) setStatus("unfocused");
        else setStatus("no-person");

      } catch (error) {
        console.error("Detection loop error:", error);
      }

      requestRef.current = requestAnimationFrame(processFrame);
    };

    requestRef.current = requestAnimationFrame(processFrame);
  }, [isActive]);

  const toggleTracking = async () => {
    if (!isActive) {
      const model = await loadModel();
      if (!model) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });

        streamRef.current = stream;
        setIsActive(true);
        setIsOpen(true);
        setIsMinimized(false);
      } catch (err) {
        console.error("Camera access failed:", err);
        toast({
          variant: "destructive",
          title: t.cameraErrorTitle,
          description: t.cameraErrorDesc,
        });
      }
    } else {
      setIsActive(false);
      stopResources();
      setFocusScore(0);
      setStatus("unfocused");
    }
  };

  // Vòng lặp nhận diện - Cần Restart khi videoRef xuất hiện trở lại (isOpen/isMinimized thay đổi)
  useEffect(() => {
    if (isActive && modelRef.current && videoRef.current) {
      startDetection();
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [isActive, startDetection, isOpen, isMinimized]); // Cần theo dõi isOpen/isMinimized để hồi sinh vòng lặp khi remount video

  // Gán/đính lại stream vào <video> mỗi khi UI mở/hiện preview và đang active.
  useEffect(() => {
    const videoEl = videoRef.current;
    if (isOpen && !isMinimized && isActive && streamRef.current && videoEl) {
      if (videoEl.srcObject !== streamRef.current) {
        videoEl.onloadedmetadata = () => {
          videoEl.play().catch((err) => {
            console.error("Video play() failed:", err);
          });
        };
        videoEl.srcObject = streamRef.current;
      }
    }
  }, [isOpen, isMinimized, isActive]);

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
              <Button variant="ghost" size="icon" onClick={() => setIsMinimized(true)} className="h-8 w-8 rounded-lg hover:bg-white/20 text-white"><Minus className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 rounded-lg hover:bg-white/20 text-white"><X className="w-5 h-5" /></Button>
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
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm text-white text-center p-4">
                  <Camera className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-relaxed">{t.systemReady}</p>
                </div>
              )}
              {modelError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/10 backdrop-blur-md text-destructive p-6 text-center">
                  <AlertTriangle className="w-10 h-10 mb-2 animate-bounce" />
                  <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">{modelError}</p>
                  <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-4 h-8 rounded-xl font-black text-[9px] uppercase tracking-widest border-2 border-destructive/20 text-destructive bg-white">RELOAD</Button>
                </div>
              )}
              {isModelLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-primary/20 backdrop-blur-md">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{t.trackingMode}</span>
                  <span className="text-xs font-bold">{isActive ? t.aiMonitorActive : t.systemPaused}</span>
                </div>
                <Switch checked={isActive} onCheckedChange={toggleTracking} disabled={isModelLoading} />
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
                  <span>FOCUS INDEX</span>
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
