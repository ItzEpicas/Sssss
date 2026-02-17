import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';

const Privacy: React.FC = () => {
  const { language } = useLanguage();

  const title =
    language === 'ka' ? 'კონფიდენციალურობის პოლიტიკა' : 'Privacy Policy';
  const subtitle =
    language === 'ka'
      ? 'როგორ ვაგროვებთ, ვიყენებთ და ვიცავთ თქვენს მონაცემებს.'
      : 'How we collect, use, and protect your information.';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 gradient-radial opacity-30" />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto">
            <header className="mb-8">
              <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight text-foreground">
                {title}
              </h1>
              <p className="mt-2 text-muted-foreground">{subtitle}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {language === 'ka'
                  ? 'ეს გვერდი არის ზოგადი შაბლონი და არ წარმოადგენს იურიდიულ რჩევას.'
                  : 'This page is a general template and does not constitute legal advice.'}
              </p>
            </header>

            <div className="glass-card rounded-2xl p-6 md:p-8 space-y-8">
              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold text-foreground">
                  {language === 'ka' ? 'რა მონაცემებს ვაგროვებთ' : 'What we collect'}
                </h2>
                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                  <li>
                    {language === 'ka'
                      ? 'ანგარიშის მონაცემები: ელ.ფოსტა, მომხმარებლის ID (ავტორიზაციისთვის).'
                      : 'Account data: email, user ID (for authentication).'}
                  </li>
                  <li>
                    {language === 'ka'
                      ? 'პროფილის მონაცემები, რომელსაც თავად ავსებთ: Minecraft nickname, Discord username/ID და სხვა.'
                      : 'Profile data you provide: Minecraft nickname, Discord username/ID, and more.'}
                  </li>
                  <li>
                    {language === 'ka'
                      ? 'შეკვეთების მონაცემები: არჩეული პროდუქტი(ები), რაოდენობა, თანხა და სტატუსი.'
                      : 'Order data: selected item(s), quantity, totals, and status.'}
                  </li>
                  <li>
                    {language === 'ka'
                      ? 'ტექნიკური მონაცემები უსაფრთხოებისთვის: შეცდომების ლოგები/მეტრიკა (შესაძლოა).'
                      : 'Technical data for security: error logs/metrics (may be collected).'}
                  </li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold text-foreground">
                  {language === 'ka' ? 'როგორ ვიყენებთ მონაცემებს' : 'How we use data'}
                </h2>
                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                  <li>
                    {language === 'ka'
                      ? 'სერვისის მიწოდება: ავტორიზაცია, პროფილი, მაღაზია, შეკვეთების მართვა.'
                      : 'Provide the service: auth, profile, shop, and order management.'}
                  </li>
                  <li>
                    {language === 'ka'
                      ? 'კომუნიკაცია/საპორტი: შეკვეთების დამუშავება და მხარდაჭერა.'
                      : 'Communication/support: processing orders and assisting users.'}
                  </li>
                  <li>
                    {language === 'ka'
                      ? 'უსაფრთხოება და თაღლითობის პრევენცია.'
                      : 'Security and fraud prevention.'}
                  </li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold text-foreground">
                  {language === 'ka' ? 'გაზიარება მესამე მხარეებთან' : 'Sharing with third parties'}
                </h2>
                <p className="text-muted-foreground">
                  {language === 'ka'
                    ? 'ჩვენ შეიძლება გამოვიყენოთ მესამე მხარის სერვისები ინფრასტრუქტურისთვის (მაგ.: მონაცემთა ბაზა, ჰოსტინგი). ასევე, შეკვეთის შეტყობინებები შეიძლება იგზავნებოდეს Discord-ში ვებჰუკის საშუალებით.'
                    : 'We may use third-party services for infrastructure (e.g., database, hosting). Order notifications may also be delivered to Discord via webhook.'}
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold text-foreground">
                  {language === 'ka' ? 'ქუქიები და ლოკალური მონაცემები' : 'Cookies & local storage'}
                </h2>
                <p className="text-muted-foreground">
                  {language === 'ka'
                    ? 'საიტმა შეიძლება გამოიყენოს localStorage/ქუქიები ავტორიზაციის სესიისთვის და კალათის დასამახსოვრებლად.'
                    : 'The site may use localStorage/cookies to keep your session and remember your cart.'}
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold text-foreground">
                  {language === 'ka' ? 'თქვენი უფლებები' : 'Your rights'}
                </h2>
                <p className="text-muted-foreground">
                  {language === 'ka'
                    ? 'შეგიძლიათ მოითხოვოთ მონაცემების ნახვა/გასუფთავება/წაშლა მხარდაჭერასთან დაკავშირების გზით.'
                    : 'You can request access, correction, or deletion of your data by contacting support.'}
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold text-foreground">
                  {language === 'ka' ? 'კონტაქტი' : 'Contact'}
                </h2>
                <p className="text-muted-foreground">
                  {language === 'ka'
                    ? 'კითხვებისთვის ან მოთხოვნებისთვის დაგვიკავშირდით Discord-ზე.'
                    : 'For questions or requests, contact us on Discord.'}
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Privacy;

