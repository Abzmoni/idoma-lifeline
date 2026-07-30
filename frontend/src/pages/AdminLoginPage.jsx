import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone || !password) return setError('All fields are required');

    setError('');
    setIsSubmitting(true);

    try {
      await api.login(phone, password);
      setIsSubmitting(false);
      navigate('/admin');
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      setError(err.message || 'Login failed. Please verify credentials.');
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-margin-mobile md:p-margin-desktop antialiased font-body-md text-on-background min-h-screen bg-[#F1F2EE]">
      
      <main className="w-full max-w-[400px] bg-white border border-outline shadow-none">
        
        {/* Active Border */}
        <div className="h-1 w-full bg-primary"></div>
        
        <div className="p-8">
          
          {/* Logo Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                signal_cellular_alt
              </span>
              <h1 className="font-headline-md text-headline-md text-on-surface">Idoma Lifeline</h1>
            </div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface-variant font-semibold">Authorized Personnel Only</h2>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-error-container border border-error text-on-error-container font-data-sm text-xs">
              ⚠️ {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Phone */}
            <div>
              <label className="block font-label-caps text-label-caps uppercase text-on-surface-variant mb-2" htmlFor="phone">
                Phone Number
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-on-surface-variant">
                  <span className="material-symbols-outlined text-[20px]">phone</span>
                </span>
                <input 
                  className="block w-full font-data-lg text-data-lg pl-10" 
                  id="phone" 
                  name="phone" 
                  placeholder="+234 801 234 5678" 
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            {/* Password / Access Code */}
            <div>
              <label className="block font-label-caps text-label-caps uppercase text-on-surface-variant mb-2" htmlFor="password">
                Access Code
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-on-surface-variant">
                  <span className="material-symbols-outlined text-[20px]">dialpad</span>
                </span>
                <input 
                  className="block w-full font-data-lg text-data-lg pl-10" 
                  id="password" 
                  name="password" 
                  required 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Submit */}
            <div className="pt-4">
              <button 
                className="w-full flex justify-center items-center bg-primary hover:bg-ink text-white font-label-caps text-label-caps uppercase tracking-wider transition-colors duration-150 h-touch-target font-bold" 
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Verifying...' : 'Log in'}
              </button>
            </div>

          </form>

          {/* Footer note */}
          <div className="mt-8 pt-4 border-t border-outline flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant mt-0.5">info</span>
            <p className="font-data-sm text-data-sm text-on-surface-variant">
              Demo accounts: Seeding creates <span className="font-semibold">+2348012345678</span> with access code <span className="font-semibold">123456</span>. Click anywhere else on the public app to return.
            </p>
          </div>

          <div className="mt-4 flex justify-center">
            <button 
              onClick={() => navigate('/')} 
              className="text-xs text-on-surface-variant hover:text-primary underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">arrow_back</span>
              Back to Public Map
            </button>
          </div>

        </div>
      </main>

    </div>
  );
}
