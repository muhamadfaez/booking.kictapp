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
import { useAuth } from "@/lib/mock-auth";
interface BookingWizardProps {
  venue: Venue | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
type Step = 'DETAILS' | 'VERIFY';
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
      toast.error("Please fill in all details");
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
      toast.success("Booking Request Submitted!");
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
  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Reserve {venue.name}</DialogTitle>
          <DialogDescription>
            Step {step === 'DETAILS' ? '1' : '2'} of 2: {step === 'DETAILS' ? 'Booking Details' : 'Verify Identity'}
          </DialogDescription>
        </DialogHeader>
        {step === 'DETAILS' ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Date</Label>
              <div className="border rounded-md p-2 flex justify-center">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))}
                  className="rounded-md"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Session</Label>
                <Select value={session} onValueChange={(v) => setSession(v as SessionSlot)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MORNING">Morning (08:00 - 12:00)</SelectItem>
                    <SelectItem value="AFTERNOON">Afternoon (13:00 - 17:00)</SelectItem>
                    <SelectItem value="EVENING">Evening (18:00 - 22:00)</SelectItem>
                    <SelectItem value="FULL_DAY">Full Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Purpose of Booking</Label>
              <Input 
                placeholder="e.g., Weekly Team Sync" 
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-6 py-8">
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">Risk-based Verification Required</p>
              <p className="text-xs text-muted-foreground">We sent a 6-digit code to {user?.email}</p>
            </div>
            <InputOTP maxLength={6} onComplete={handleFinalSubmit} disabled={isSubmitting}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            <p className="text-xs text-muted-foreground">Demo code: Any 6 digits</p>
          </div>
        )}
        <DialogFooter>
          {step === 'DETAILS' ? (
            <Button onClick={handleNext} className="w-full">Continue to Verification</Button>
          ) : (
            <Button variant="ghost" onClick={() => setStep('DETAILS')} disabled={isSubmitting} className="w-full">
              Back to Details
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}