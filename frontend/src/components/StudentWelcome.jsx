import React, { useState } from 'react';
import { Bot, Sparkles, Zap, Star } from 'lucide-react';
import { useSchool } from '../contexts/SchoolContext';
import './StudentWelcome.css';

const StudentWelcome = ({ userName }) => {
  const { school } = useSchool();

  // Apply accent color using CSS variables (same approach as Sidebar)
  const bannerStyle = {
    '--banner-accent': school?.accent_color || '#3b82f6',
    '--banner-accent-dark': school?.secondary_color || school?.accent_color || '#1d4ed8',
  };

  const iconColor = school?.accent_color || '#3b82f6';

  // Fun welcome messages with DC/Marvel, Anime, and puns
  const welcomeMessages = [
    {
      title: "With great power...",
      subtitle: "Comes great grades! Uncle Ben would be proud of your study grind 🕷️"
    },
    {
      title: "Believe it! Dattebayo!",
      subtitle: "Your ninja way is completing assignments on time. Shadow clone study session? 🍜"
    },
    {
      title: "I am Iron Study!",
      subtitle: "Tony Stark built this dashboard in a cave... with a box of assignments! 🦾"
    },
    {
      title: "Plus Ultra!",
      subtitle: "Go beyond your limits! All Might believes in your academic hero journey 💪"
    },
    {
      title: "Wakanda Forever!",
      subtitle: "Vibranium-level intelligence detected. T'Challa approves this dashboard 👑"
    },
    {
      title: "It's over 9000!",
      subtitle: "Your power level is rising! Time to go Super Saiyan on these grades 🔥"
    },
    {
      title: "Why so studious?",
      subtitle: "The Joker couldn't distract you from your goals. Now that's dedication! 🃏"
    },
    {
      title: "Kamehameha!",
      subtitle: "Channel your inner Goku and blast through those assignments! 🌊"
    },
    {
      title: "Avengers, Assemble!",
      subtitle: "Your study squad is ready. Time to snap those grades into existence ⚡"
    },
    {
      title: "One Punch Study!",
      subtitle: "Saitama didn't become strong by slacking. 100 assignments, 100 grades! 👊"
    },
    {
      title: "I'm Batman.",
      subtitle: "Dark Knight mode activated. Fighting crime? No. Fighting F's? Yes. 🦇"
    },
    {
      title: "Omae wa mou shindeiru",
      subtitle: "Your procrastination is already dead. Kenshiro would be impressed! 👀"
    },
    {
      title: "Fastest Man Alive!",
      subtitle: "Flash through those assignments before time runs out. Speed force engaged! ⚡"
    },
    {
      title: "All according to keikaku*",
      subtitle: "*Keikaku means plan. And your plan? Ace everything on this dashboard! 📓"
    },
    {
      title: "Perfectly balanced...",
      subtitle: "As all things should be. Thanos approves of your work-life balance 💎"
    },
    {
      title: "Yare yare daze...",
      subtitle: "JoJo's got nothing on your bizarre academic adventure. ORA ORA! ⭐"
    },
    {
      title: "You're a wizard!",
      subtitle: "Expecto Grade-tronum! Magic or hard work? Both work at Hogwarts Academy! ⚡"
    },
    {
      title: "I can do this all day",
      subtitle: "Captain America's spirit lives in your dedication. Shield up, grades up! 🛡️"
    },
    {
      title: "ZA WARUDO!",
      subtitle: "Time stop! But seriously, manage your time and DIO would be jealous ⏰"
    },
    {
      title: "Hasta la vista, baby",
      subtitle: "Terminator mode: eliminating bad grades since day one. I'll be back... with A's! 🤖"
    }
  ];

  // Select a random message on component mount
  const [currentMessage] = useState(() => {
    const randomIndex = Math.floor(Math.random() * welcomeMessages.length);
    return welcomeMessages[randomIndex];
  });

  return (
    <div className="student-welcome-section" style={bannerStyle}>
      <div className="student-welcome-content-wrapper">
        <div className="student-welcome-robots">
          <div className="student-robot-left">
            <Bot size={42} strokeWidth={1.5} color={iconColor} />
            <Sparkles className="student-sparkle-icon student-sparkle-left-1" size={14} />
            <Zap className="student-sparkle-icon student-sparkle-left-2" size={12} />
          </div>
          <div className="student-robot-right">
            <Bot size={42} strokeWidth={1.5} color={iconColor} />
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
