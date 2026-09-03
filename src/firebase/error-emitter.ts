
'use client';

type Callback = (data: unknown) => void;

class ErrorEmitter {
  private listeners: { [key: string]: Callback[] } = {};

  on(event: string, callback: Callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  emit(event: string, data: unknown) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }
}

export const errorEmitter = new ErrorEmitter();
