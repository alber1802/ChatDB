import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthCard } from './auth-card';
import { ShowcaseSection } from './showcase-section';

export const AuthPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div
            id="auth-container"
            className="relative flex min-h-screen w-full items-center justify-center overflow-hidden font-sans text-slate-100"
        >
            <style>{`
                #auth-container {
                    background-color: hsla(244, 100%, 50%, 1);
                    background-image: radial-gradient(circle at 50% 0%, hsla(319, 0%, 0%, 1) 49.15975941515135%, transparent 102.23193813062571%);
                    background-blend-mode: normal;
                }
                .bg-grid-pattern {
                    background-size: 50px 50px;
                    background-image: linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
                                      linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
                }
                .perspective-container {
                    perspective: 1500px;
                }
                .perspective-image {
                    transform-style: preserve-3d;
                    transform: rotateX(8deg) rotateY(-10deg) rotateZ(3deg);
                    transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.6s ease;
                }
                .perspective-image:hover {
                    transform: rotateX(4deg) rotateY(-5deg) rotateZ(1deg) scale(1.02);
                    box-shadow: 0 30px 60px -15px rgba(99, 102, 241, 0.3), 0 0 50px -10px rgba(168, 85, 247, 0.2);
                }
                @keyframes float {
                    0%, 100% {
                        transform: translateY(0px) rotateX(8deg) rotateY(-10deg) rotateZ(3deg);
                    }
                    50% {
                        transform: translateY(-12px) rotateX(10deg) rotateY(-8deg) rotateZ(3.5deg);
                    }
                }
                .animate-float {
                    animation: float 8s ease-in-out infinite;
                }
            `}</style>

            {/* Background elements */}
            <div className="bg-grid-pattern pointer-events-none absolute inset-0" />
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-[10%] top-[20%] h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[130px]" />
                <div className="absolute bottom-[20%] right-[10%] h-[500px] w-[500px] rounded-full bg-purple-600/10 blur-[130px]" />
            </div>

            {/* Floating background image for mobile/tablet */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden lg:hidden">
                <div className="w-[120%] max-w-lg translate-y-12 -rotate-12 transform opacity-[0.08]">
                    <img
                        src="/chartdb.png"
                        alt="background diagram"
                        className="h-auto w-full"
                    />
                </div>
            </div>

            <div className="relative z-10 grid w-full max-w-6xl grid-cols-1 gap-8 p-4 md:p-8 lg:grid-cols-12 lg:gap-16">
                <AuthCard onLoginSuccess={() => navigate('/')} />
                <ShowcaseSection />
            </div>
        </div>
    );
};
