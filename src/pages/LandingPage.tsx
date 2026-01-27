import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Calendar, Zap, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/mock-auth';
import { ThemeToggle } from '@/components/ThemeToggle';
export default function LandingPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const handleLogin = (role: 'USER' | 'ADMIN') => {
    login(role);
    navigate('/dashboard');
  };
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ThemeToggle />
      <div className="absolute inset-0 bg-gradient-rainbow opacity-5 pointer-events-none" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-20 md:py-32 lg:py-40 text-center space-y-12">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-primary flex items-center justify-center shadow-primary floating">
              <Sparkles className="w-10 h-10 text-white rotating" />
            </div>
          </div>
          <div className="space-y-6 max-w-3xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-balance">
              Workspace <span className="text-gradient">Optimization</span> at the Edge
            </h1>
            <p className="text-xl text-muted-foreground text-pretty">
              The next-generation booking system for high-performance teams. 
              Atomic availability, risk-based OTP, and seamless institutional control.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="btn-gradient w-full sm:w-auto px-8 py-6 text-lg" onClick={() => handleLogin('USER')}>
              Login as Standard User
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto px-8 py-6 text-lg" onClick={() => handleLogin('ADMIN')}>
              Admin Command Center
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12 border-t mt-20">
            <div className="flex flex-col items-center space-y-3">
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="font-bold">Edge-Native Speed</h3>
              <p className="text-sm text-muted-foreground">Powered by Cloudflare Workers for sub-50ms interaction times globally.</p>
            </div>
            <div className="flex flex-col items-center space-y-3">
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold">Atomic Integrity</h3>
              <p className="text-sm text-muted-foreground">Durable Objects ensure zero overbooking with strict transaction logic.</p>
            </div>
            <div className="flex flex-col items-center space-y-3">
              <div className="p-3 rounded-full bg-primary/10 text-primary">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="font-bold">Smart Sync</h3>
              <p className="text-sm text-muted-foreground">Automatic Google Calendar integration and conflict management.</p>
            </div>
          </div>
        </div>
      </main>
      <footer className="py-8 text-center text-muted-foreground text-sm">
        &copy; 2024 Nexus Reserve. Built for the modern enterprise.
      </footer>
    </div>
  );
}