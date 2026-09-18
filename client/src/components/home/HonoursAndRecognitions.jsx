import { Award } from 'lucide-react';
import Carousel from './Carousel.jsx';
import SmartImg from './SmartImg.jsx';

const honours = Array.from({ length: 6 }, (_, i) => `/homepage/mentors/honor-${i + 1}.png`);

// Same breakpoints as the original Swiper config.
const breakpoints = { 0: 1.2, 480: 1.8, 768: 2.5, 1024: 3.5, 1200: 4 };

export default function HonoursAndRecognitions() {
  return (
    <section className="aa-honours">
      <div className="aa-container">
        <h2 className="aa-h2">
          Honours and <span>Recognitions</span>
        </h2>
      </div>

      <div className="aa-honours__slider">
        <Carousel
          label="Honours and recognitions"
          items={honours}
          breakpoints={breakpoints}
          gap={24}
          autoplay={2000}
          arrows
          renderItem={(src, i) => (
            <div className="aa-honour">
              <SmartImg
                src={src}
                alt={`Honour ${i + 1}`}
                fallback={
                  <div className="aa-placeholder" style={{ aspectRatio: '4 / 3' }}>
                    <Award size={40} />
                    Recognition #{i + 1}
                  </div>
                }
              />
            </div>
          )}
        />
      </div>
    </section>
  );
}
