'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './worker-signin.module.css';

export default function WorkerSigninPage() {
    const router = useRouter();
    const [stage, setStage] = useState<'email' | 'otp'>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const response = await fetch('/worker-signin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            if (!response.ok) {
                const data = await response.json();
                setError(data.error || 'Failed to send OTP');
                setLoading(false);
                return;
            }

            setSuccess('OTP sent to your email. Check your inbox.');
            setStage('otp');
        } catch (err: any) {
            setError(err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    const handleOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const response = await fetch('/worker/verify-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Include cookies
                body: JSON.stringify({ email, otp }),
            });

            if (!response.ok) {
                const data = await response.json();
                setError(data.error || 'Invalid OTP');
                setLoading(false);
                return;
            }

            setSuccess('Signin successful! Redirecting...');
            setTimeout(() => {
                router.push('/worker/dashboard');
            }, 1000);
        } catch (err: any) {
            setError(err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>ShiftWise Worker Sign-In</h1>
                <p className={styles.subtitle}>Access your compliance documents</p>

                {error && <div className={styles.error}>{error}</div>}
                {success && <div className={styles.success}>{success}</div>}

                {stage === 'email' ? (
                    <form onSubmit={handleEmailSubmit} className={styles.form}>
                        <div className={styles.formGroup}>
                            <label htmlFor="email" className={styles.label}>
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="your.email@example.com"
                                className={styles.input}
                                disabled={loading}
                            />
                        </div>

                        <button
                            type="submit"
                            className={styles.button}
                            disabled={loading || !email}
                        >
                            {loading ? 'Sending...' : 'Send Sign-In Code'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleOtpSubmit} className={styles.form}>
                        <p className={styles.otpInfo}>
                            A 6-digit code was sent to <strong>{email}</strong>
                        </p>

                        <div className={styles.formGroup}>
                            <label htmlFor="otp" className={styles.label}>
                                Sign-In Code
                            </label>
                            <input
                                id="otp"
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                required
                                placeholder="000000"
                                maxLength={6}
                                className={styles.otpInput}
                                disabled={loading}
                                inputMode="numeric"
                            />
                        </div>

                        <button
                            type="submit"
                            className={styles.button}
                            disabled={loading || otp.length !== 6}
                        >
                            {loading ? 'Verifying...' : 'Verify Code'}
                        </button>

                        <button
                            type="button"
                            className={styles.backButton}
                            onClick={() => {
                                setStage('email');
                                setOtp('');
                                setError('');
                                setSuccess('');
                            }}
                            disabled={loading}
                        >
                            Back
                        </button>
                    </form>
                )}

                <p className={styles.footer}>
                    ShiftWise — Compliance Management for UK Healthcare Staffing
                </p>
            </div>
        </div>
    );
}
