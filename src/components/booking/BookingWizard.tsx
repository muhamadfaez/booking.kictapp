import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { format } from "date-fns";
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
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [purpose, setPurpose] = useState('');

  // New State
  const [programType, setProgramType] = useState<ProgramType>('STUDENT');
  const [proposalFile, setProposalFile] = useState<File | null>(null);
  const [approvalFile, setApprovalFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!venue) return null;

  const handleNext = async () => {
    if (step === 'DETAILS') {
      if (!date || !purpose.trim() || !startTime || !endTime) {
        toast.error("Please fill in all details");
        return;
      }
      if (startTime >= endTime) {
        toast.error("End time must be after start time");
        return;
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

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data; // Returns { url, downloadUrl }
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const baseMeta = {
        purpose,
        date: format(date!, 'yyyy-MM-dd'),
        userName: user?.name || 'UnknownUser'
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

      await api('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          venueId: venue.id,
          userId: user?.id,
          userName: user?.name,
          date: format(date!, 'yyyy-MM-dd'),
          startTime,
          endTime,
          // session removed
          purpose,
          programType,
          documents: {
            proposalUrl: proposalDocs.url,
            proposalDownloadUrl: proposalDocs.downloadUrl,
            approvalLetterUrl: approvalDocs.url,
            approvalLetterDownloadUrl: approvalDocs.downloadUrl
          }
        })
      });
      toast.success("Booking Request Submitted!", {
        description: "Documents uploaded and request pending approval.",
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
    setDate(new Date());
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
    <div className="space-y-2">
      <Label className="text-sm font-semibold flex items-center gap-2">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className={`border-2 border-dashed rounded-xl p-4 transition-all ${file ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}>
        {file ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileIcon className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="text-destructive hover:bg-destructive/10">
              Remove
            </Button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 cursor-pointer py-4">
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
      <DialogContent className="sm:max-w-[300px] md:max-w-[650px] p-0 overflow-hidden transition-all duration-300">
        <div className="bg-gradient-subtle p-5 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{venue.name}</DialogTitle>
            <DialogDescription className="mt-2">
              New Booking Request
            </DialogDescription>
          </DialogHeader>

          {/* Steps */}
          <div className="flex items-center gap-2 mt-5 text-xs font-semibold">
            <div className={`px-3 py-1 rounded-full ${step === 'DETAILS' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>1. Details</div>
            <div className="w-4 h-px bg-border"></div>
            <div className={`px-3 py-1 rounded-full ${step === 'DOCS' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>2. Documents</div>
            <div className="w-4 h-px bg-border"></div>
            <div className={`px-3 py-1 rounded-full ${step === 'REVIEW' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>3. Review</div>
          </div>
        </div>

        <div className="p-6">
          {step === 'DETAILS' && (
            <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
              <div className="space-y-4">
                <Label>Date</Label>
                <div className="border rounded-xl p-3 flex justify-center">
                  <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md" disabled={(d) => d < new Date()} />
                </div>
              </div>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Purpose</Label>
                  <Input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Event Name" />
                </div>
                <div className="space-y-2">
                  <Label>Program Type</Label>
                  <RadioGroup value={programType} onValueChange={(v) => setProgramType(v as ProgramType)} className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="STUDENT" id="r1" />
                      <Label htmlFor="r1">Student</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="STAFF" id="r2" />
                      <Label htmlFor="r2">Staff</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="GUEST" id="r3" />
                      <Label htmlFor="r3">Guest</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>
          )}

          {step === 'DOCS' && (
            <div className="space-y-6 animate-fade-in py-2">
              <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-3 rounded-lg text-sm mb-4">
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
            <div className="space-y-6 animate-fade-in">
              <div className="bg-muted/50 p-4 rounded-xl space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground font-medium mb-1">Venue</p>
                    <p className="font-semibold">{venue.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium mb-1">Date & Time</p>
                    <p className="font-semibold">{date ? format(date, 'MMM dd, yyyy') : 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">{startTime} - {endTime}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium mb-1">Purpose</p>
                    <p className="font-semibold">{purpose}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium mb-1">Program Type</p>
                    <p className="font-semibold">{programType}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Documents to be Uploaded
                </h4>
                <div className="space-y-2">
                  {proposalFile && (
                    <div className="flex items-center gap-2 text-sm bg-card border p-2 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>{proposalFile.name} (Proposal)</span>
                    </div>
                  )}
                  {approvalFile && (
                    <div className="flex items-center gap-2 text-sm bg-card border p-2 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span>{approvalFile.name} (Approval Letter)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-5 pt-0">
          <div className="flex w-full justify-between gap-2">
            {step !== 'DETAILS' && (
              <Button variant="outline" onClick={() => setStep(step === 'REVIEW' ? 'DOCS' : 'DETAILS')} disabled={isSubmitting}>
                Back
              </Button>
            )}
            {step !== 'REVIEW' ? (
              <Button onClick={handleNext} className="ml-auto w-full md:w-auto">Next <ArrowRight className="w-4 h-4 ml-2" /></Button>
            ) : (
              <Button onClick={handleFinalSubmit} disabled={isSubmitting} className="ml-auto w-full md:w-auto btn-gradient">
                {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : "Confirm & Submit Request"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}