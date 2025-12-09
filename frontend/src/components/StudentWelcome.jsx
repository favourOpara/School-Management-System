import React, { useState, useEffect } from 'react';
import { Bot, Sparkles, Zap, Star } from 'lucide-react';
import './StudentWelcome.css';

const StudentWelcome = ({ userName }) => {
  // Gen-Z style welcome messages that rotate
  const welcomeMessages = [
    {
      title: "Yooo, what's good!",
      subtitle: "Your dashboard is lowkey fire today. Let's get this bread! 🔥"
    },
    {
      title: "Ayy, you made it!",
      subtitle: "Time to slay your assignments and vibe with the squad 💯"
    },
    {
      title: "Bestie energy detected!",
      subtitle: "Your grades are about to be bussin, no cap fr fr 🚀"
    },
    {
      title: "Main character vibes!",
      subtitle: "You're literally the GOAT. Now go crush those goals ✨"
    },
    {
      title: "Period, let's go!",
      subtitle: "It's giving academic excellence. Time to serve looks AND grades 💅"
    },
    {
      title: "Sheesh, looking fresh!",
      subtitle: "Your dashboard just hit different today, we stan! 🌟"
    },
    {
      title: "No cap, you're here!",
      subtitle: "Ready to absolutely demolish those assignments? Let's get it! 💪"
    },
    {
      title: "Slay the day!",
      subtitle: "Main character moment: You vs Your goals. Spoiler: You win 🏆"
    },
    {
      title: "It's giving scholar!",
      subtitle: "Your brain is about to pop off today, we love to see it 🧠"
    },
    {
      title: "Rent free in success!",
      subtitle: "Education is your side hustle and you're killing it bestie 📚"
    },
    {
      title: "Living for this!",
      subtitle: "You woke up and chose excellence. That's so slay of you ⚡"
    },
    {
      title: "Ate and left no crumbs!",
      subtitle: "Ready to serve academic realness? Your dashboard awaits 🎯"
    },
    {
      title: "Understood the assignment!",
      subtitle: "Plot twist: You're the smart one. Let's prove it today 📖"
    },
    {
      title: "Caught in 4K studying!",
      subtitle: "Your dedication is unmatched. Time to flex those grades 📸"
    },
    {
      title: "Touch grass later!",
      subtitle: "Right now it's all about that grind. Your future self says thanks 🌱"
    }
  ];

  // Select a random message on component mount
  const [currentMessage] = useState(() => {
    const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
    return welcomeMessages[randomIndex];
  });

  return (
    <div className="student-welcome-section">
      <div className="student-welcome-content-wrapper">
        <div className="student-welcome-robots">
          <div className="student-robot-left">
            <Bot size={42} strokeWidth={1.5} />
            <Sparkles className="student-sparkle-icon student-sparkle-left-1" size={14} />
            <Zap className="student-sparkle-icon student-sparkle-left-2" size={12} />
          </div>
          <div className="student-robot-right">
            <Bot size={42} strokeWidth={1.5} />
            <Star className="student-sparkle-icon student-sparkle-right-1" size={14} />
            <Sparkles className="student-sparkle-icon student-sparkle-right-2" size={12} />
          </div>
        </div>
        <div className="student-welcome-text-content">
          <h1 className="student-welcome-title">{currentMessage.title}</h1>
          <p className="student-welcome-subtitle">{currentMessage.subtitle}</p>
        </div>
      </div>
    </div>
  );
};

export default StudentWelcome;
