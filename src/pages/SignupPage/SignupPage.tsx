import { ChangeEventHandler, FormEventHandler, useState } from 'react';

import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { OtpInput } from '~/components/ui/otp-input';
import { supabase } from '~/supabaseClient';

export function Signup() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const handleLogin: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error?.message) {
      alert(error.message);
    } else {
      setEmailSent(true);
      alert('Check your email for the login link or use the code below!');
    }
    setLoading(false);
  };

  const handleOtpVerification = async (otpCode: string) => {
    setVerifyingOtp(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'email',
    });

    if (error?.message) {
      alert(error.message);
    }
    setVerifyingOtp(false);
  };

  const handleResend = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error?.message) {
      alert(error.message);
    } else {
      alert('New login link and code sent to your email!');
    }
    setLoading(false);
  };

  const handleTryOtp = () => {
    setShowOtpInput(true);
  };

  const handleChangeEmail: ChangeEventHandler<HTMLInputElement> = (e) => {
    setEmail(e.target.value);
  };

  return (
    <div className="safe-area-top safe-area-bottom flex h-screen items-center justify-center">
      <div className="flex w-full max-w-sm flex-col gap-2 p-3">
        <div className="text-center text-lg font-bold text-foreground">
          Sign up or Log in to BellSkill
        </div>

        {!emailSent ? (
          <form onSubmit={handleLogin} className="space-y-2">
            <Input
              id="email"
              type="email"
              placeholder="Enter your email address..."
              value={email}
              required={true}
              onChange={handleChangeEmail}
              className="h-5 text-base"
            />

            <Button
              type="submit"
              loading={loading}
              size="lg"
              className="w-full"
            >
              Continue with Email
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="text-center text-sm text-muted-foreground">
              We've sent a login link to <strong>{email}</strong>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              Click the link in your email to sign in, or enter the 6-digit code
              below
            </div>

            {showOtpInput && (
              <div className="space-y-3">
                <OtpInput
                  value={otp}
                  onChange={setOtp}
                  onComplete={handleOtpVerification}
                  disabled={verifyingOtp}
                />

                {verifyingOtp && (
                  <div className="text-center text-sm text-muted-foreground">
                    Verifying code...
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {!showOtpInput && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTryOtp}
                  className="w-full"
                >
                  Enter 6-digit code instead
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                onClick={handleResend}
                loading={loading}
                className="w-full"
              >
                Resend email
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
