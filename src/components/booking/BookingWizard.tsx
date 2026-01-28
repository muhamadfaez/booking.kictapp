import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Venue, SessionSlot } from "@shared/types";
import { api } from "@/lib/api-client";
import { useAuth } from '@/hooks/useAuth';
import { CalendarDays, Clock, FileText, Shield, ArrowRight, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';

interface BookingWizardProps {
  venue: Venue | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'DETAILS' | 'VERIFY';

const sessionOptions = [
  { value: 'MORNING', label: 'Morning', time: '08:00 - 12:00' },
  { value: 'AFTERNOON', label: 'Afternoon', time: '13:00 - 17:00' },
  { value: 'EVENING', label: 'Evening', time: '18:00 - 22:00' },
  { value: 'FULL_DAY', label: 'Full Day', time: '08:00 - 22:00' },
];

export function BookingWizard({ venue, isOpen, onClose, onSuccess }: BookingWizardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('DETAILS');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [session, setSession] = useState<SessionSlot>('MORNING');
  const [purpose, setPurpose] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!venue) return null;

  const handleNext = () => {
    if (!date || !purpose.trim()) {
      toast.error("Please fill in all details", {
        description: "Select a date and enter the purpose of your booking."
      });
      return;
    }
    setStep('VERIFY');
  };

  const handleFinalSubmit = async (otpValue: string) => {
    if (otpValue.length !== 6) return;
    setIsSubmitting(true);
    try {
      await api('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          venueId: venue.id,
          userId: user?.id,
          userName: user?.name,
          date: format(date!, 'yyyy-MM-dd'),
          session,
          purpose
        })
      });
      toast.success("Booking Request Submitted!", {
        description: "Your request is pending admin approval.",
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />
      });
      onSuccess();
      onClose();
      reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to book");
      setStep('DETAILS');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setStep('DETAILS');
    setDate(new Date());
    setSession('MORNING');
    setPurpose('');
  };

  const selectedSession = sessionOptions.find(s => s.value === session);

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-subtle p-6 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{venue.name}</DialogTitle>
            <DialogDescription className="mt-2">
              {venue.location} • Capacity: {venue.capacity} people
            </DialogDescription>
          </DialogHeader>

          {/* Progress Steps */}
          <div className="flex items-center gap-3 mt-6">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${step === 'DETAILS'
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'bg-card text-muted-foreground'
              }`}>
              <CalendarDays className="w-4 h-4" />
              <span>1. Details</span>
            </div>
            <div className="h-px flex-1 bg-border" />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${step === 'VERIFY'
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'bg-card text-muted-foreground'
              }`}>
              <Shield className="w-4 h-4" />
              <span>2. Verify</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'DETAILS' ? (
            <div className="space-y-6 animate-fade-in">
              {/* Date Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  Select Date
                </Label>
                <div className="border rounded-xl p-2 bg-card">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    className="rounded-lg mx-auto"
                  />
                </div>
              </div>

              {/* Session Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Session Time
                </Label>
                <Select value={session} onValueChange={(v) => setSession(v as SessionSlot)}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="py-3">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-xs text-muted-foreground">{opt.time}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Purpose */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Purpose of Booking
                </Label>
                <Input
                  placeholder="e.g., Weekly Team Sync, Client Presentation"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-8 py-6 animate-fade-in">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <p className="text-lg font-semibold">Verification Required</p>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code sent to <span className="font-medium text-foreground">{user?.email}</span>
                </p>
              </div>

              <InputOTP maxLength={6} onComplete={handleFinalSubmit} disabled={isSubmitting}>
                <InputOTPGroup className="gap-2">
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="w-12 h-14 text-lg font-bold rounded-xl border-2 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              <p className="text-xs text-muted-foreground bg-muted/50 px-4 py-2 rounded-full">
                Demo: Enter any 6 digits to proceed
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-6 pt-0">
          {step === 'DETAILS' ? (
            <Button onClick={handleNext} className="w-full btn-gradient h-12 rounded-xl text-base font-semibold">
              Continue to Verification
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setStep('DETAILS')}
              disabled={isSubmitting}
              className="w-full h-12 rounded-xl text-base"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowLeft className="mr-2 w-5 h-5" />
                  Back to Details
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}