import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths
} from "date-fns";
import type { Booking, Venue } from "@shared/types";
import { api } from "@/lib/api-client";
import { useAuth } from '@/hooks/useAuth';
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Loader2, UploadCloud, File as FileIcon, FileText } from 'lucide-react';
import { cn } from "@/lib/utils";

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

const dateKey = (date: Date) => format(startOfDay(date), 'yyyy-MM-dd');

const dateRange = (start: Date, end: Date) => {
  const first = startOfDay(start);
  const last = startOfDay(end);
  const direction = first <= last ? 1 : -1;
  const dates: Date[] = [];
  let cursor = first;

  while (direction === 1 ? cursor <= last : cursor >= last) {
    dates.push(cursor);
    cursor = addDays(cursor, direction);
  }

  return dates;
};

function FormField({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 text-left">
      <Label className="block text-sm font-semibold text-foreground">{label}</Label>
      {children}
    </div>
  );
}

function MultiDateBookingCalendar({
  selectedDates,
  onChange,
  isDateDisabled,
  isDateBooked,
  today
}: {
  selectedDates: Date[];
  onChange: (dates: Date[]) => void;
  isDateDisabled: (date: Date) => boolean;
  isDateBooked: (date: Date) => boolean;
  today: Date;
}) {
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(today));
  const [dragStart, setDragStart] = useState<Date | null>(null);
  const [dragPreviewKeys, setDragPreviewKeys] = useState<Set<string>>(new Set());
  const [didDrag, setDidDrag] = useState(false);

  const monthStart = startOfMonth(visibleMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(endOfMonth(visibleMonth));
  const days = dateRange(calendarStart, calendarEnd);
  const selectedKeySet = useMemo(() => new Set(selectedDates.map(dateKey)), [selectedDates]);
  const highlightedKeys = dragStart
    ? new Set([...selectedKeySet, ...dragPreviewKeys])
    : selectedKeySet;

  const availableRangeKeys = (start: Date, end: Date) => {
    return new Set(dateRange(start, end).filter((date) => !isDateDisabled(date)).map(dateKey));
  };

  const updateDragPreview = (target: Date) => {
    if (!dragStart || isDateDisabled(target)) return;
    setDidDrag((current) => current || dateKey(target) !== dateKey(dragStart));
    setDragPreviewKeys(availableRangeKeys(dragStart, target));
  };

  const commitRange = () => {
    if (!dragStart) return;
    if (!didDrag) {
      const key = dateKey(dragStart);
      const next = selectedKeySet.has(key)
        ? selectedDates.filter((date) => dateKey(date) !== key)
        : [...selectedDates, dragStart];
      onChange(next.sort((a, b) => a.getTime() - b.getTime()));
    } else {
      const merged = new Map<string, Date>();
      selectedDates.forEach((date) => merged.set(dateKey(date), date));
      dragPreviewKeys.forEach((key) => merged.set(key, startOfDay(new Date(`${key}T00:00:00`))));
      onChange(Array.from(merged.values()).sort((a, b) => a.getTime() - b.getTime()));
    }

    setDragStart(null);
    setDragPreviewKeys(new Set());
    setDidDrag(false);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-calendar-date]');
    const key = target?.dataset.calendarDate;
    if (!key) return;
    updateDragPreview(startOfDay(new Date(`${key}T00:00:00`)));
  };

  useEffect(() => {
    if (!dragStart) return;
    const stopDrag = () => commitRange();
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
    return () => {
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };
  });

  return (
    <div className="rounded-2xl border border-border bg-background p-3 shadow-sm sm:p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-xl"
          onClick={() => setVisibleMonth((current) => subMonths(current, 1))}
          disabled={isBefore(endOfMonth(subMonths(visibleMonth, 1)), today)}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-sm font-semibold">{format(visibleMonth, 'MMMM yyyy')}</div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-xl"
          onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-2">{day}</div>
        ))}
      </div>

      <div
        className="grid touch-none select-none grid-cols-7 gap-y-1"
        onPointerMove={handlePointerMove}
      >
        {days.map((day) => {
          const key = dateKey(day);
          const selected = highlightedKeys.has(key);
          const booked = isDateBooked(day);
          const disabled = isDateDisabled(day);
          const inMonth = isSameMonth(day, visibleMonth);
          const previousDay = addDays(day, -1);
          const nextDay = addDays(day, 1);
          const connectsLeft = selected && highlightedKeys.has(dateKey(previousDay)) && previousDay.getDay() !== 6;
          const connectsRight = selected && highlightedKeys.has(dateKey(nextDay)) && day.getDay() !== 6;

          return (
            <button
              key={key}
              type="button"
              data-calendar-date={key}
              disabled={disabled}
              onPointerDown={(event) => {
                if (disabled) return;
                event.preventDefault();
                setDragStart(startOfDay(day));
                setDragPreviewKeys(new Set([key]));
                setDidDrag(false);
              }}
              onPointerEnter={() => updateDragPreview(day)}
              className={cn(
                "relative flex h-11 min-h-11 items-center justify-center text-sm transition-colors outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring sm:h-12 sm:min-h-12",
                selected && "bg-primary/15 text-primary",
                selected && !connectsLeft && "rounded-l-full",
                selected && !connectsRight && "rounded-r-full",
                !selected && "rounded-xl hover:bg-muted",
                !inMonth && "text-muted-foreground/40",
                booked && "bg-red-50 text-red-700 line-through opacity-100 hover:bg-red-50 dark:bg-red-950/40 dark:text-red-300",
                disabled && !booked && "cursor-not-allowed text-muted-foreground/40 opacity-60",
                disabled && "pointer-events-auto"
              )}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full",
                  selected && "bg-primary text-primary-foreground shadow-sm",
                  booked && "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200"
                )}
              >
                {format(day, 'd')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BookingWizard({ venue, isOpen, onClose, onSuccess }: BookingWizardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('DETAILS');
  const [selectedDates, setSelectedDates] = useState<Date[]>([new Date()]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState('');

  // New State
  const [programType, setProgramType] = useState<ProgramType>('STUDENT');
  const [proposalFile, setProposalFile] = useState<File | null>(null);
  const [approvalFile, setApprovalFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogTopOffset, setDialogTopOffset] = useState(64);

  const today = useMemo(() => startOfDay(new Date()), []);

  const { data: occupancyBookings = [], isFetching: isFetchingBookings } = useQuery({
    queryKey: ['bookings-occupancy', venue?.id],
    queryFn: () => api<Booking[]>('/api/bookings/occupancy'),
    enabled: isOpen && !!venue && !!user,
    refetchInterval: isOpen ? 30000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 10 * 1000
  });

  useEffect(() => {
    if (!isOpen) return;

    const updateDialogOffset = () => {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('nav, header'));
      const topBars = candidates
        .map((element) => {
          const styles = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return { element, styles, rect };
        })
        .filter(({ styles, rect }) => {
          const isPinned = styles.position === 'fixed' || styles.position === 'sticky';
          return isPinned && Math.abs(rect.top) <= 2 && rect.height > 0;
        });

      const offset = topBars.reduce((max, { rect }) => Math.max(max, rect.bottom), 64);
      setDialogTopOffset(Math.ceil(offset));
    };

    updateDialogOffset();
    window.addEventListener('resize', updateDialogOffset);
    window.addEventListener('scroll', updateDialogOffset, { passive: true });

    return () => {
      window.removeEventListener('resize', updateDialogOffset);
      window.removeEventListener('scroll', updateDialogOffset);
    };
  }, [isOpen]);

  const orderedDates = useMemo(
    () => [...selectedDates].sort((a, b) => a.getTime() - b.getTime()),
    [selectedDates]
  );
  const primaryDate = orderedDates[0];

  const bookedDateKeys = useMemo(() => {
    if (!venue) return new Set<string>();
    return new Set(
      occupancyBookings
        .filter((booking) => booking.venueId === venue.id)
        .map((booking) => booking.date)
    );
  }, [occupancyBookings, venue]);

  const isBookedDate = (date: Date) => bookedDateKeys.has(format(date, 'yyyy-MM-dd'));
  const isPastDate = (date: Date) => isBefore(startOfDay(date), today);

  useEffect(() => {
    if (bookedDateKeys.size === 0) return;
    setSelectedDates((current) => current.filter((date) => !bookedDateKeys.has(format(date, 'yyyy-MM-dd'))));
  }, [bookedDateKeys]);

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
          requesterPhone: phone,
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
        queryClient.invalidateQueries({ queryKey: ['bookings-occupancy'] }),
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
    setPhone('');
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
      <DialogContent
        style={{
          '--booking-dialog-top': `${dialogTopOffset}px`,
          '--booking-dialog-max-height': `calc(100vh - ${dialogTopOffset}px - 16px)`
        } as React.CSSProperties}
        className="left-1/2 top-[var(--booking-dialog-top)] z-[120] w-[calc(100vw-1rem)] max-h-[var(--booking-dialog-max-height)] translate-y-0 gap-0 overflow-y-auto rounded-2xl p-0 transition-all duration-300 sm:w-[96vw] sm:max-w-[600px] sm:rounded-[2rem] md:max-w-[760px]"
      >
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
            <div className="mx-auto w-full max-w-2xl space-y-5 text-left animate-fade-in">
              <FormField label="Requester Name">
                <Input
                  value={user?.name || ''}
                  readOnly
                  className="h-11 w-full rounded-xl bg-muted/40 px-4 text-sm focus-visible:ring-2"
                />
              </FormField>

              <FormField label="Email">
                <Input
                  value={user?.email || localStorage.getItem('nexus_user_email') || ''}
                  readOnly
                  className="h-11 w-full rounded-xl bg-muted/40 px-4 text-sm focus-visible:ring-2"
                />
              </FormField>

              <FormField label="Phone">
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Contact number"
                  className="h-11 w-full rounded-xl px-4 text-sm focus-visible:ring-2"
                />
              </FormField>

              <FormField label="Venue">
                <Input
                  value={venue.name}
                  readOnly
                  className="h-11 w-full rounded-xl bg-muted/40 px-4 text-sm focus-visible:ring-2"
                />
              </FormField>

              <FormField label="Date">
                <MultiDateBookingCalendar
                  selectedDates={orderedDates}
                  onChange={setSelectedDates}
                  isDateDisabled={(date) => isPastDate(date) || isBookedDate(date)}
                  isDateBooked={isBookedDate}
                  today={today}
                />
                <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-medium text-muted-foreground md:justify-start">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-red-500" />
                    Booked
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-emerald-500" />
                    Available
                  </span>
                  {isFetchingBookings ? <span>Refreshing availability...</span> : null}
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Selected: </span>
                  {orderedDates.length > 0
                    ? orderedDates.map((value) => format(value, 'd MMM yyyy')).join(', ')
                    : 'No dates selected'}
                </div>
              </FormField>

              <FormField label="Start Time">
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-11 w-full rounded-xl px-4 text-sm focus-visible:ring-2"
                />
              </FormField>

              <FormField label="End Time">
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-11 w-full rounded-xl px-4 text-sm focus-visible:ring-2"
                />
              </FormField>

              <FormField label="Notes / Purpose">
                <Textarea
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  placeholder="Event name, purpose, or setup notes"
                  className="min-h-24 w-full resize-y rounded-xl px-4 py-3 text-sm focus-visible:ring-2"
                />
              </FormField>

              <FormField label="Program Type">
                <RadioGroup value={programType} onValueChange={(v) => setProgramType(v as ProgramType)} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex h-11 items-center gap-3 rounded-xl border border-input px-4">
                    <RadioGroupItem value="STUDENT" id="r1" />
                    <Label htmlFor="r1" className="text-sm font-medium">Student</Label>
                  </div>
                  <div className="flex h-11 items-center gap-3 rounded-xl border border-input px-4">
                    <RadioGroupItem value="STAFF" id="r2" />
                    <Label htmlFor="r2" className="text-sm font-medium">Staff</Label>
                  </div>
                  <div className="flex h-11 items-center gap-3 rounded-xl border border-input px-4">
                    <RadioGroupItem value="GUEST" id="r3" />
                    <Label htmlFor="r3" className="text-sm font-medium">Guest</Label>
                  </div>
                </RadioGroup>
              </FormField>
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
