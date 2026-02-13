import React, { useState } from 'react';
import { GraduationCap, Sparkles, Star, Zap } from 'lucide-react';
import { useSchool } from '../contexts/SchoolContext';
import './ParentWelcome.css';

const ParentWelcome = ({ userName }) => {
  const { school } = useSchool();

  // Apply accent color using CSS variables (same approach as Sidebar)
  const bannerStyle = {
    '--banner-accent': school?.accent_color || '#3b82f6',
    '--banner-accent-dark': school?.secondary_color || school?.accent_color || '#1d4ed8',
  };

  const iconColor = school?.accent_color || '#3b82f6';

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Motivational quotes for parents hustling for their children's future
  const parentQuotes = [
    {
      title: "Behind every great child...",
      subtitle: "Is a parent who believed in them first. Your investment today builds their tomorrow 💫"
    },
    {
      title: "The greatest legacy...",
      subtitle: "We can leave our children is a great education. You're building their future, one day at a time 🌟"
    },
    {
      title: "Your sacrifice today...",
      subtitle: "Is their success story tomorrow. Every school fee paid is an investment in their dreams ✨"
    },
    {
      title: "Hustle in silence...",
      subtitle: "Let their success make the noise. Your dedication doesn't go unnoticed 🙏"
    },
    {
      title: "Education is the passport...",
      subtitle: "To the future. Thank you for ensuring they have their ticket stamped 🎓"
    },
    {
      title: "You're not just paying fees...",
      subtitle: "You're opening doors to possibilities they can't even imagine yet 🚪"
    },
    {
      title: "The hand that rocks the cradle...",
      subtitle: "Rules the world. Your guidance shapes tomorrow's leaders 👑"
    },
    {
      title: "Great parents don't create kids...",
      subtitle: "They create environments where kids can thrive. You're doing amazing! 🌱"
    },
    {
      title: "Behind the late nights and early mornings...",
      subtitle: "Is a parent building a better future. Your hustle is their hope 💪"
    },
    {
      title: "The best investment...",
      subtitle: "Is in your child's education. The returns? Priceless. 💎"
    },
    {
      title: "You're not just working hard...",
      subtitle: "You're showing them what dedication looks like. Lead by example 🏆"
    },
    {
      title: "Every assignment you monitor...",
      subtitle: "Every report card you review, you're saying 'I believe in you' 📚"
    },
    {
      title: "The hustle is real...",
      subtitle: "But so is the reward. Their success will make every sacrifice worth it ⭐"
    },
    {
      title: "Champions are raised...",
      subtitle: "Not born. You're raising tomorrow's champion today 🥇"
    },
    {
      title: "Your today's sweat...",
      subtitle: "Is their tomorrow's comfort. Keep pushing, you're doing great! 💧"
    },
    {
      title: "In the story of their success...",
      subtitle: "You're the unsung hero. The dedication you show today echoes forever 📖"
    },
    {
      title: "Education is not expensive...",
      subtitle: "Ignorance is. Thank you for choosing to invest in knowledge 🎯"
    },
    {
      title: "The price of success...",
      subtitle: "Is hard work and dedication. You're paying it forward for them 🌟"
    },
    {
      title: "Your sacrifice doesn't go unseen...",
      subtitle: "It's being written in the pages of their future success story 📝"
    },
    {
      title: "Great futures are built...",
      subtitle: "One school day at a time. Your consistency is their foundation 🏗️"
    }
  ];

  // Select a random quote on component mount
  const [currentQuote] = useState(() => {
    const randomIndex = Math.floor(Math.random() * parentQuotes.length);
    return parentQuotes[randomIndex];
  });

  return (
    <div className="parent-welcome-section" style={bannerStyle}>
      <div className="parent-welcome-content-wrapper">
        <div className="parent-welcome-hearts">
          <div className="parent-heart-left">
            <GraduationCap size={42} strokeWidth={1.5} color={iconColor} />
            <Sparkles className="parent-sparkle-icon parent-sparkle-left-1" size={14} />
            <Zap className="parent-sparkle-icon parent-sparkle-left-2" size={12} />
          </div>
          <div className="parent-heart-right">
            <GraduationCap size={42} strokeWidth={1.5} color={iconColor} />
            <Star className="parent-sparkle-icon parent-sparkle-right-1" size={14} />
            <Sparkles className="parent-sparkle-icon parent-sparkle-right-2" size={12} />
          </div>
        </div>
        <div className="parent-welcome-text-content">
          <h1 className="parent-welcome-greeting">{getGreeting()}, {userName}!</h1>
          <h2 className="parent-welcome-title">{currentQuote.title}</h2>
          <p className="parent-welcome-subtitle">{currentQuote.subtitle}</p>
        </div>
      </div>
    </div>
  );
};

export default ParentWelcome;
