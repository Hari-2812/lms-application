import { Quote } from 'lucide-react';
import Carousel from './Carousel.jsx';
import SmartImg from './SmartImg.jsx';

const stats = [
  { figure: '2000+', heading: 'Personal & Professional', desc: 'Consultations by Our Data Scientists Panel' },
  { figure: '100+', heading: 'High-Performance ML Models', desc: 'Production-ready, highly accurate models' },
  { figure: '15+', heading: 'Smart AI Automation', desc: 'Streamline and automate workflows' },
  { figure: '1000+', heading: 'Empowering Rural Talent', desc: 'Empowered with Data Analytics Skills' },
  { figure: '500+', heading: 'Nationwide Professionals', desc: 'Industry-ready projects for careers' },
  { figure: '50+', heading: 'Guest Lectures and MOUs', desc: 'Bridging academia with industry excellence' },
];

const testimonials = [
  '/homepage/testimonials/1771919718-testimonial-1.png',
  '/homepage/testimonials/1771919729-testimonial-2.png',
  '/homepage/testimonials/1771919740-testimonial-3.png',
  '/homepage/testimonials/1771919752-testimonial-4.png',
  '/homepage/testimonials/1771919764-testimonial-5.png',
  '/homepage/testimonials/1771919773-testimonial-6.png',
  '/homepage/testimonials/1771919784-testimonial-7.png',
  '/homepage/testimonials/1771919794-testimonial-8.png',
];

export default function TestimonialsSection() {
  return (
    <section className="aa-aspirants">
      <div className="aa-container aa-aspirants__grid">
        <div>
          <h2 className="aa-h2">
            Hear It From <span>Our Aspirants</span>
          </h2>
          <div className="aa-stats">
            {stats.map((stat) => (
              <div key={stat.heading} className="aa-stat">
                <h4>{stat.figure}</h4>
                <p className="aa-stat__heading">{stat.heading}</p>
                <p className="aa-stat__desc">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="aa-aspirants__slider">
          <Carousel
            label="Aspirant testimonials"
            items={testimonials}
            autoplay={7000}
            dots
            renderItem={(src, i) => (
              <div className="aa-testimonial">
                <SmartImg
                  src={src}
                  alt={`Aspirant testimonial ${i + 1}`}
                  fallback={
                    <div className="aa-placeholder">
                      <Quote size={36} fill="currentColor" />
                      Aspirant story #{i + 1}
                    </div>
                  }
                />
              </div>
            )}
          />
        </div>
      </div>
    </section>
  );
}
