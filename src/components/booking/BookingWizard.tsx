import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { format, isSameDay } from "date-fns";
import type { Venue, SessionSlot } from "@shared/types";
import { api } from "@/lib/api-client";
import { useAuth } from '@/hooks/useAuth';
import { ArrowRight, CheckCircle2, Loader2, UploadCloud, File as FileIcon, FileText } from 'lucide-react';

interface BookingWizardProps {
  venue: Venue | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'DETAILS' | 'DOCS' | 'REVIEW';
type ProgramType = 'STUDENT' | 'STAFF' | 'GUEST';
type AvailabilityResult = {
  availableVenueIds: string[];
  unavailableVenueIds: string[];
};

const sessionOptions = [
  { value: 'MORNING', label: 'Morning', time: '08:00 - 12:00' },
  { value: 'AFTERNOON', label: 'Afternoon', time: '13:00 - 17:00' },
  { value: 'EVENING', label: 'Evening', time: '18:00 - 22:00' },
  { value: 'FULL_DAY', label: 'Full Day', time: '08:00 - 22:00' },
];

export function BookingWizard({ venue, isOpen, onClose, onSuccess }: BookingWizardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('DETAILS');
  const [selectedDates, setSelectedDates] = useState<Date[]>([new Date()]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [purpose, setPurpose] = useState('');

  // New State
  const [programType, setProgramType] = useState<ProgramType>('STUDENT');
  const [proposalFile, setProposalFile] = useState<File | null>(null);
  const [approvalFile, setApprovalFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const orderedDates = useMemo(
    () => [...selectedDates].sort((a, b) => a.getTime() - b.getTime()),
    [selectedDates]
  );
  const primaryDate = orderedDates[0];

  if (!venue) return null;

  const handleNext = async () => {
    if (step === 'DETAILS') {
      if (orderedDates.length === 0 || !purpose.trim() || !startTime || !endTime) {
        toast.error("Please fill in all details");
        return;
      }
      if (startTime >= endTime) {
        toast.error("End time must be after start time");
        return;
      }

      for (const selectedDate of orderedDates) {
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        const availability = await api<AvailabilityResult>(
          `/api/venues/availability?date=${encodeURIComponent(formattedDate)}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`
        );
        if (!availability.availableVenueIds.includes(venue.id)) {
          toast.error(`"${venue.name}" is not available on ${format(selectedDate, 'dd MMM yyyy')} for ${startTime}-${endTime}.`);
          return;
        }
      }

      setStep('DOCS');
    } else if (step === 'DOCS') {
      // Validate Docs
      if (!proposalFile) {
        toast.error("Proposal document is required");
        return;
      }
      if (programType === 'STUDENT' && !approvalFile) {
        toast.error("Approval Letter is required for Student Programs");
        return;
      }
      setStep('REVIEW');
    }
  };

  const uploadFileToDrive = async (file: File, meta: { docType: string, purpose: string, date: string, userName: string }) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('docType', meta.docType);
    formData.append('purpose', meta.purpose);
    formData.append('date', meta.date);
    formData.append('userName', meta.userName);

    const token = localStorage.getItem('nexus_token');
    if (!token) {
      throw new Error("You are not logged in. Please refresh or login again.");
    }
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`
    };

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers,
      body: formData
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data; // Returns { url, downloadUrl }
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const fallbackEmail = localStorage.getItem('nexus_user_email') || '';
      const requesterEmail = user?.email || fallbackEmail;
      const requesterName = user?.name || (requesterEmail ? requesterEmail.split('@')[0] : '');

      const baseMeta = {
        purpose,
        date: format(primaryDate!, 'yyyy-MM-dd'),
        userName: requesterName || 'UnknownUser'
      };

      // Upload Files
      let proposalDocs = { url: '', downloadUrl: '' };
      let approvalDocs = { url: '', downloadUrl: '' };

      if (proposalFile) {
        proposalDocs = await uploadFileToDrive(proposalFile, { ...baseMeta, docType: 'PROPOSAL' });
      }
      if (programType === 'STUDENT' && approvalFile) {
        approvalDocs = await uploadFileToDrive(approvalFile, { ...baseMeta, docType: 'APPROVAL_LETTER' });
      }

      await api('/api/bookings/batch', {
        method: 'POST',
        body: JSON.stringify({
          venueId: venue.id,
          dates: orderedDates.map((value) => format(value, 'yyyy-MM-dd')),
          startTime,
          endTime,
          purpose,
          programType,
          requesterEmail,
          requesterName,
          documents: {
            proposalUrl: proposalDocs.url,
            proposalDownloadUrl: proposalDocs.downloadUrl,
            approvalLetterUrl: approvalDocs.url,
            approvalLetterDownloadUrl: approvalDocs.downloadUrl
          }
        })
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['my-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['all-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['bookings-schedule'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-venues-availability'] }),
        queryClient.invalidateQueries({ queryKey: ['venues-availability'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
      ]);
      toast.success("Booking Request Submitted!", {
        description: `${orderedDates.length} booking request${orderedDates.length > 1 ? 's were' : ' was'} submitted and pending approval.`,
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />
      });
      onSuccess();
      onClose();
      reset();
    } catch (err: any) {
      toast.error(err.message || "Failed to book");
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setStep('DETAILS');
    setSelectedDates([new Date()]);
    setStartTime('08:00');
    setEndTime('10:00');
    setPurpose('');
    setProgramType('STUDENT');
    setProposalFile(null);
    setApprovalFile(null);
  };
  // ...
  // ...
  const FileUploader = ({
    label,
    file,
    setFile,
    required
  }: { label: string, file: File | null, setFile: (f: File | null) => void, required?: boolean }) => (
    <div className="space-y-2 text-center sm:text-left">
      <Label className="inline-flex items-center gap-2 text-sm font-semibold">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className={`rounded-2xl border-2 border-dashed p-4 transition-all ${file ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}>
        {file ? (
          <div className="flex flex-col items-center justify-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileIcon className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="rounded-xl text-destructive hover:bg-destructive/10">
              Remove
            </Button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 py-6">
            <UploadCloud className="w-8 h-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Click to upload</p>
              <p className="text-xs text-muted-foreground">PDF, DOCX up to 10MB</p>
            </div>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
            />
          </label>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[96vw] max-h-[90vh] gap-0 overflow-y-auto rounded-[2rem] p-0 transition-all duration-300 sm:max-w-[600px] md:max-w-[700px]">
        <div className="bg-gradient-subtle p-5 border-b border-border/50 text-center sm:text-left">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{venue.name}</DialogTitle>
            <DialogDescription className="sr-only">
              Complete the booking details, upload required documents, and review your request before submission.
            </DialogDescription>
          </DialogHeader>

          {/* Steps */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold sm:justify-start">
            <div className={`px-3 py-1 rounded-full ${step === 'DETAILS' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>1. Details</div>
            <div className="hidden sm:block w-4 h-px bg-border"></div>
            <div className={`px-3 py-1 rounded-full ${step === 'DOCS' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>2. Documents</div>
            <div className="hidden sm:block w-4 h-px bg-border"></div>
            <div className={`px-3 py-1 rounded-full ${step === 'REVIEW' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>3. Review</div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {step === 'DETAILS' && (
            <div className="grid gap-5 md:grid-cols-2 md:gap-6 animate-fade-in">
              <div className="mx-auto w-full max-w-[340px] space-y-4 text-center md:mx-0 md:max-w-none md:text-left">
                <Label className="inline-block">Date</Label>
                <div className="overflow-x-auto border rounded-xl p-2 sm:p-3 flex justify-center">
                  <Calendar
                    mode="multiple"
                    selected={orderedDates}
                    onSelect={(value) => setSelectedDates(value ?? [])}
                    className="rounded-md min-w-[280px]"
                    disabled={(d) => d < new Date()}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {orderedDates.length} date{orderedDates.length > 1 ? 's' : ''} selected
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                    {orderedDates.map((value) => (
                      <Button
                        key={value.toISOString()}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setSelectedDates((current) => current.filter((item) => !isSameDay(item, value)))}
                      >
                        {format(value, 'dd MMM')}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mx-auto w-full max-w-[340px] min-w-0 space-y-5 text-center md:mx-0 md:max-w-none md:text-left">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <Label className="inline-block">Start Time</Label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="h-11 w-full min-w-0 max-w-full text-sm sm:text-base"
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label className="inline-block">End Time</Label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="h-11 w-full min-w-0 max-w-full text-sm sm:text-base"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="inline-block">Purpose</Label>
                  <Input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Event Name" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="inline-block">Program Type</Label>
                  <RadioGroup value={programType} onValueChange={(v) => setProgramType(v as ProgramType)} className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3 sm:text-left">
                    <div className="flex items-center justify-center space-x-2 sm:justify-start">
                      <RadioGroupItem value="STUDENT" id="r1" />
                      <Label htmlFor="r1">Student</Label>
                    </div>
                    <div className="flex items-center justify-center space-x-2 sm:justify-start">
                      <RadioGroupItem value="STAFF" id="r2" />
                      <Label htmlFor="r2">Staff</Label>
                    </div>
                    <div className="flex items-center justify-center space-x-2 sm:justify-start">
                      <RadioGroupItem value="GUEST" id="r3" />
                      <Label htmlFor="r3">Guest</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
          )}

          {step === 'DOCS' && (
            <div className="mx-auto w-full max-w-[340px] space-y-6 py-2 text-center animate-fade-in sm:max-w-none sm:text-left">
              <div className="mb-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                Uploading documents to Google Drive. Please ensure files are under 10MB.
              </div>

              <FileUploader
                label="Program Proposal"
                file={proposalFile}
                setFile={setProposalFile}
                required
              />

              {programType === 'STUDENT' && (
                <FileUploader
                  label="SDCE Approval Letter"
                  file={approvalFile}
                  setFile={setApprovalFile}
                  required
                />
              )}
            </div>
          )}

          {step === 'REVIEW' && (
            <div className="mx-auto w-full max-w-[340px] space-y-6 text-center animate-fade-in sm:max-w-none sm:text-left">
              <div className="space-y-4 rounded-2xl bg-muted/50 p-5">
                <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-medium mb-1">Venue</p>
                    <p className="font-semibold">{venue.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-medium mb-1">Date & Time</p>
                    <p className="font-semibold">{orderedDates.length} scheduled date{orderedDates.length > 1 ? 's' : ''}</p>
                    <p className="text-xs text-muted-foreground">{startTime} - {endTime}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-medium mb-1">Purpose</p>
                    <p className="font-semibold">{purpose}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-medium mb-1">Program Type</p>
                    <p className="font-semibold">{programType}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2 rounded-2xl border bg-card p-4">
                  <h4 className="text-sm font-semibold">Selected Dates</h4>
                  <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                    {orderedDates.map((value) => (
                      <span key={value.toISOString()} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                        {format(value, 'EEE, dd MMM yyyy')}
                      </span>
                    ))}
                  </div>
                </div>
                <h4 className="flex items-center justify-center gap-2 text-sm font-semibold sm:justify-start">
                  <FileText className="w-4 h-4 text-primary" />
                  Documents to be Uploaded
                </h4>
                <div className="space-y-2">
                  {proposalFile && (
                    <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card p-3 text-sm sm:justify-start">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>{proposalFile.name} (Proposal)</span>
                    </div>
                  )}
                  {approvalFile && (
                    <div className="flex items-center justify-center gap-2 rounded-2xl border bg-card p-3 text-sm sm:justify-start">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>{approvalFile.name} (Approval Letter)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 pt-0 sm:p-5 sm:pt-0">
          <div className="flex w-full flex-col gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
            {step !== 'DETAILS' && (
              <Button variant="outline" onClick={() => setStep(step === 'REVIEW' ? 'DOCS' : 'DETAILS')} disabled={isSubmitting} className="rounded-2xl">
                Back
              </Button>
            )}
            {step !== 'REVIEW' ? (
              <Button onClick={handleNext} className="ml-auto w-full rounded-2xl md:w-auto">Next <ArrowRight className="w-4 h-4 ml-2" /></Button>
            ) : (
              <Button onClick={handleFinalSubmit} disabled={isSubmitting} className="btn-gradient ml-auto w-full rounded-2xl md:w-auto">
                {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : "Confirm & Submit Request"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
