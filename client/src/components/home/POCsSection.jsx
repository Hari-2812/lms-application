import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Presentation } from 'lucide-react';
import SmartImg from './SmartImg.jsx';

const images = [
  '/homepage/works/image1.png',
  '/homepage/works/image2.png',
  '/homepage/works/image3.png',
  '/homepage/works/image4.png',
  '/homepage/works/image5.png',
  '/homepage/works/image6.png',
  '/homepage/works/image7.png',
  '/homepage/works/image7-1.png',
];

export default function POCsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(() => setCurrentIndex((prev) => (prev + 1) % images.length), 4000);
    return () => clearInterval(timer);
  }, [paused]);

  const handlePrev = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  const handleNext = () => setCurrentIndex((prev) => (prev + 1) % images.length);

  return (
    <section className="poc-section">
      <style>{`
        .poc-section { padding: 64px 0; background-color: #f8fafc; }
        .poc-container { max-width: 1000px; margin: 0 auto; padding: 0 16px; }
        .poc-heading-container { text-align: center; margin-bottom: 40px; }
        .poc-slideshow-wrapper {
          position: relative; background-color: #fff; border-radius: 16px;
          box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0; overflow: hidden;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .poc-slideshow-wrapper:hover { transform: translateY(-4px); box-shadow: 0 30px 60px rgba(15, 23, 42, 0.12); }
        .poc-slideshow-container {
          position: relative; width: 100%; aspect-ratio: 16/9; background-color: #fff;
          display: flex; align-items: center; justify-content: center;
        }
        .poc-slide-image {
          position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain;
          opacity: 0; transition: opacity 0.8s ease-in-out; pointer-events: none; padding: 10px;
        }
        .poc-slide-image.active { opacity: 1; pointer-events: auto; }
        .poc-slide-placeholder {
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
          background: linear-gradient(160deg, #EBF3FE, #fff); color: #1A73E8;
          font-family: 'Sora', sans-serif; font-weight: 600; font-size: 18px;
        }
        .poc-arrow {
          position: absolute; top: 50%; transform: translateY(-50%); background-color: rgba(15, 23, 42, 0.6);
          color: #fff; border: none; width: 44px; height: 44px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10;
          transition: background-color 0.2s ease, transform 0.2s ease, opacity 0.2s ease; opacity: 0;
        }
        .poc-slideshow-container:hover .poc-arrow, .poc-arrow:focus-visible { opacity: 1; }
        .poc-arrow:hover { background-color: rgba(15, 23, 42, 0.85); transform: translateY(-50%) scale(1.05); }
        .poc-arrow-left { left: 16px; }
        .poc-arrow-right { right: 16px; }
        .poc-dots { position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; z-index: 10; }
        .poc-dot {
          width: 10px; height: 10px; border-radius: 50%; background-color: rgba(15, 23, 42, 0.2);
          border: none; padding: 0; cursor: pointer; transition: background-color 0.2s ease, transform 0.2s ease;
        }
        .poc-dot.active { background-color: #2563eb; transform: scale(1.2); }
        @media (max-width: 768px) {
          .poc-section { padding: 40px 0; }
          .poc-arrow { width: 36px; height: 36px; opacity: 0.6; }
          .poc-slide-image { padding: 5px; }
        }
      `}</style>
      <div className="poc-container">
        <div className="poc-heading-container">
          <h2 className="aa-h2">
            Recreate The Projects Worked By <span>Top Data Scientists</span> for Your Placement Journey
          </h2>
        </div>

        <div
          className="poc-slideshow-wrapper"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="poc-slideshow-container">
            {images.map((src, index) => {
              const cls = `poc-slide-image ${index === currentIndex ? 'active' : ''}`;
              return (
                <SmartImg
                  key={src}
                  src={src}
                  alt={`Capstone Project ${index + 1}`}
                  className={cls}
                  loading={index === currentIndex || index === (currentIndex + 1) % images.length ? 'eager' : 'lazy'}
                  fallback={
                    <div className={`${cls} poc-slide-placeholder`}>
                      <Presentation size={48} />
                      Capstone Project {index + 1}
                    </div>
                  }
                />
              );
            })}

            <button type="button" className="poc-arrow poc-arrow-left" onClick={handlePrev} aria-label="Previous Project">
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
            <button type="button" className="poc-arrow poc-arrow-right" onClick={handleNext} aria-label="Next Project">
              <ChevronRight size={24} strokeWidth={2.5} />
            </button>

            <div className="poc-dots">
              {images.map((src, index) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`poc-dot ${index === currentIndex ? 'active' : ''}`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
