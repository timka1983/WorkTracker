import React from 'react';
import screenshot1 from '../../assets/screenshot1.png';
import screenshot2 from '../../assets/screenshot2.png';
import screenshot3 from '../../assets/screenshot3.png';
import screenshot4 from '../../assets/screenshot4.png';
import screenshot5 from '../../assets/screenshot5.png';
import screenshot6 from '../../assets/screenshot6.png';

const images = [screenshot1, screenshot2, screenshot3, screenshot4, screenshot5, screenshot6];

export const BackgroundCollage: React.FC = () => {
  return (
    <div className="absolute left-0 top-0 w-1/3 h-full pointer-events-none opacity-80">
      <div className="relative w-full h-full">
        {images.map((img, i) => (
          <img
            key={i}
            src={img}
            alt={`Screenshot ${i + 1}`}
            className="absolute top-1/4 left-0 w-64 h-auto rounded-xl shadow-2xl border-2 border-white/50 transition-transform duration-500"
            style={{
              transform: `rotate(${(i - 2) * 10}deg) translateX(${i * 20}px)`,
              zIndex: i
            }}
            referrerPolicy="no-referrer"
          />
        ))}
      </div>
    </div>
  );
};
