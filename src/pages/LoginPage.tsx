import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Mail, ArrowLeft, Loader2, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

// Simulated verification codes storage (in production, this would be server-side)
const pendingVerifications: Map<string, string> = new Map();

// Generate a 6-digit code
function generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function LoginPage() {
    const navigate = useNavigate();
    const { loginWithEmail, loginWithGoogle } = useAuth();
    const [email, setEmail] = useState('');
    const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
    const [showVerification, setShowVerification] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [sentCode, setSentCode] = useState('');
    const [showCodeSentMessage, setShowCodeSentMessage] = useState(false);

    // Google Sign In Modal State
    const [showGoogleModal, setShowGoogleModal] = useState(false);
    const [googleEmail, setGoogleEmail] = useState('');
    const [googleLoading, setGoogleLoading] = useState(false);
    const [googleError, setGoogleError] = useState('');

    const handleGoogleSignIn = () => {
        setShowGoogleModal(true);
        setGoogleEmail('');
        setGoogleError('');
    };

    const handleGoogleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!googleEmail.trim()) {
            setGoogleError('Please enter your email address');
            return;
        }

        if (!googleEmail.includes('@')) {
            setGoogleError('Please enter a valid email address');
            return;
        }

        setGoogleLoading(true);
        setGoogleError('');

        // Simulate Google OAuth verification
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Extract name from email
        const name = googleEmail.split('@')[0]
            .split('.')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');

        // Login with the Google credentials
        const user = loginWithGoogle(
            googleEmail,
            name,
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(googleEmail)}`
        );

        setShowGoogleModal(false);
        setGoogleLoading(false);

        // Redirect based on role
        if (user.role === 'ADMIN') {
            navigate('/admin');
        } else {
            navigate('/dashboard');
        }
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) {
            setError('Please enter your email address');
            return;
        }
        if (!email.includes('@')) {
            setError('Please enter a valid email address');
            return;
        }

        setError('');
        setIsLoading(true);

        // Generate and store verification code
        const code = generateVerificationCode();
        pendingVerifications.set(email.toLowerCase(), code);
        setSentCode(code);

        // Simulate sending email (with delay)
        await new Promise(resolve => setTimeout(resolve, 1500));

        setIsLoading(false);
        setShowVerification(true);
        setShowCodeSentMessage(true);

        // Hide the code message after 15 seconds
        setTimeout(() => setShowCodeSentMessage(false), 15000);

        // In production, you would send an actual email here
        console.log(`Verification code for ${email}: ${code}`);
    };

    const handleCodeChange = (index: number, value: string) => {
        if (value.length > 1) return;
        if (value && !/^\d$/.test(value)) return;

        const newCode = [...verificationCode];
        newCode[index] = value;
        setVerificationCode(newCode);

        if (value && index < 5) {
            const nextInput = document.getElementById(`code-${index + 1}`);
            nextInput?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
            const prevInput = document.getElementById(`code-${index - 1}`);
            prevInput?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').trim();
        if (/^\d{6}$/.test(pastedData)) {
            const digits = pastedData.split('');
            setVerificationCode(digits);
            const lastInput = document.getElementById('code-5');
            lastInput?.focus();
        }
    };

    const handleVerifyCode = async () => {
        const enteredCode = verificationCode.join('');
        if (enteredCode.length !== 6) {
            setError('Please enter all 6 digits');
            return;
        }

        setError('');
        setIsLoading(true);

        await new Promise(resolve => setTimeout(resolve, 1000));

        const storedCode = pendingVerifications.get(email.toLowerCase());

        if (enteredCode === storedCode) {
            pendingVerifications.delete(email.toLowerCase());
            const user = loginWithEmail(email);

            if (user.role === 'ADMIN') {
                navigate('/admin');
            } else {
                navigate('/dashboard');
            }
        } else {
            setError('Invalid verification code. Please try again.');
            setIsLoading(false);
        }
    };

    const handleBackToEmail = () => {
        setShowVerification(false);
        setVerificationCode(['', '', '', '', '', '']);
        setError('');
        setSentCode('');
        setShowCodeSentMessage(false);
    };

    const handleResendCode = async () => {
        setIsLoading(true);
        setError('');

        const code = generateVerificationCode();
        pendingVerifications.set(email.toLowerCase(), code);
        setSentCode(code);

        await new Promise(resolve => setTimeout(resolve, 1000));

        setIsLoading(false);
        setShowCodeSentMessage(true);
        setTimeout(() => setShowCodeSentMessage(false), 15000);

        console.log(`New verification code for ${email}: ${code}`);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex flex-col">
            {/* Header */}
            <header className="w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <button
                            onClick={() => navigate('/')}
                            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                        >
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 shadow-md">
                                <Building2 className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-lg font-bold tracking-tight">BookingTrack</span>
                                <span className="text-[10px] text-muted-foreground hidden sm:block">Professional Venue Management</span>
                            </div>
                        </button>
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-md space-y-8">
                    {/* Logo and Title */}
                    <div className="text-center space-y-4">
                        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-lg">
                            <Building2 className="w-10 h-10 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-gradient">IIUM Community</h1>
                            <p className="text-muted-foreground mt-2">Sign in to access venue booking</p>
                        </div>
                    </div>

                    {/* Login Card */}
                    <Card className="p-8 space-y-6 shadow-xl border-border/50">
                        {/* Google Sign In */}
                        <div className="space-y-4">
                            <Button
                                onClick={handleGoogleSignIn}
                                disabled={isLoading}
                                className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 shadow-sm rounded-xl transition-all duration-300 hover:shadow-md"
                            >
                                <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                                    <path
                                        fill="#4285F4"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                                Sign In with Google
                            </Button>
                        </div>

                        {/* Divider */}
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-card px-3 text-muted-foreground font-medium">Public</span>
                            </div>
                        </div>

                        {/* Email Verification */}
                        {!showVerification ? (
                            <form onSubmit={handleEmailSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="email" className="text-sm font-medium text-foreground">
                                        Enter Email
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="your.email@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="pl-10 h-12 rounded-xl"
                                            autoComplete="email"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Admin access: <span className="font-mono text-primary">muhamadfaez@iium.edu.my</span>
                                    </p>
                                </div>
                                {error && (
                                    <p className="text-sm text-destructive">{error}</p>
                                )}
                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-12 text-base font-medium btn-gradient rounded-xl"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Sending Code...
                                        </>
                                    ) : (
                                        'Get Verification Code'
                                    )}
                                </Button>
                            </form>
                        ) : (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-foreground">
                                            Enter 6-digit verification code
                                        </label>
                                        <button
                                            onClick={handleBackToEmail}
                                            className="text-sm text-primary hover:underline flex items-center gap-1"
                                        >
                                            <ArrowLeft className="h-3 w-3" />
                                            Change email
                                        </button>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        We sent a code to <span className="font-medium text-foreground">{email}</span>
                                    </p>
                                </div>

                                {/* Show verification code for demo purposes */}
                                {showCodeSentMessage && sentCode && (
                                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                        <div className="text-sm">
                                            <p className="font-medium text-emerald-800 dark:text-emerald-200">Demo Mode</p>
                                            <p className="text-emerald-700 dark:text-emerald-300">
                                                Your code is: <span className="font-mono font-bold">{sentCode}</span>
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* 6-digit code input */}
                                <div className="flex justify-center gap-3" onPaste={handlePaste}>
                                    {verificationCode.map((digit, index) => (
                                        <Input
                                            key={index}
                                            id={`code-${index}`}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleCodeChange(index, e.target.value)}
                                            onKeyDown={(e) => handleKeyDown(index, e)}
                                            className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 focus:border-primary transition-all"
                                            autoComplete="one-time-code"
                                        />
                                    ))}
                                </div>

                                {error && (
                                    <p className="text-sm text-destructive text-center">{error}</p>
                                )}

                                <Button
                                    onClick={handleVerifyCode}
                                    disabled={isLoading || verificationCode.join('').length !== 6}
                                    className="w-full h-12 text-base font-medium btn-gradient rounded-xl"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Verifying...
                                        </>
                                    ) : (
                                        'Verify & Sign In'
                                    )}
                                </Button>

                                <p className="text-center text-sm text-muted-foreground">
                                    Didn't receive the code?{' '}
                                    <button
                                        onClick={handleResendCode}
                                        disabled={isLoading}
                                        className="text-primary hover:underline font-medium disabled:opacity-50"
                                    >
                                        Resend
                                    </button>
                                </p>
                            </div>
                        )}
                    </Card>

                    {/* Footer */}
                    <p className="text-center text-sm text-muted-foreground">
                        By signing in, you agree to our{' '}
                        <a href="#" className="text-primary hover:underline">Terms of Service</a>
                        {' '}and{' '}
                        <a href="#" className="text-primary hover:underline">Privacy Policy</a>
                    </p>
                </div>
            </main>

            {/* Google Sign In Modal */}
            <Dialog open={showGoogleModal} onOpenChange={setShowGoogleModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                            <svg className="h-6 w-6" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            Sign in with Google
                        </DialogTitle>
                        <DialogDescription>
                            Enter your Google account email to continue
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleGoogleSubmit} className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <label htmlFor="google-email" className="text-sm font-medium">
                                Email Address
                            </label>
                            <Input
                                id="google-email"
                                type="email"
                                placeholder="you@gmail.com"
                                value={googleEmail}
                                onChange={(e) => setGoogleEmail(e.target.value)}
                                className="h-11"
                                autoComplete="email"
                                autoFocus
                            />
                            <p className="text-xs text-muted-foreground">
                                For admin access, use: <span className="font-mono text-primary">muhamadfaez@iium.edu.my</span>
                            </p>
                        </div>

                        {googleError && (
                            <p className="text-sm text-destructive">{googleError}</p>
                        )}

                        <div className="flex gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowGoogleModal(false)}
                                className="flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={googleLoading}
                                className="flex-1"
                            >
                                {googleLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Continue'
                                )}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
