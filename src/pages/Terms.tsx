import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';

const Terms: React.FC = () => {
  const { language } = useLanguage();

  const title =
    language === 'ka' ? 'მომსახურების პირობები' : 'Terms of Service';
  const subtitle =
    language === 'ka'
      ? 'RageMC-ს გამოყენებით თქვენ ეთანხმებით ქვემოთ ჩამოთვლილ წესებს.'
      : 'By using RageMC, you agree to the rules below.';

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
                  {language === 'ka' ? 'სერვისის გამოყენება' : 'Using the service'}
                </h2>
                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                  <li>
                    {language === 'ka'
                      ? 'ნუ გამოიყენებთ სერვისს უკანონო ან მავნე მიზნებისთვის.'
                      : 'Do not use the service for illegal or harmful purposes.'}
                  </li>
                  <li>
                    {language === 'ka'
                      ? 'დაიცავით საზოგადოების წესები და პატივი ეცით სხვა მოთამაშეებს.'
                      : 'Follow community rules and respect other players.'}
                  </li>
                  <li>
                    {language === 'ka'
                      ? 'შესაძლოა დაგჭირდეთ ანგარიში გარკვეული ფუნქციებისთვის.'
                      : 'An account may be required for certain features.'}
                  </li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold text-foreground">
                  {language === 'ka' ? 'შეკვეთები და ციფრული ნივთები' : 'Orders & digital items'}
                </h2>
                <p className="text-muted-foreground">
                  {language === 'ka'
                    ? 'მაღაზიაში შეძენილი ნივთები შეიძლება იყოს ციფრული/ინ-გეიმ კონტენტი. შეკვეთების დამუშავება შესაძლოა მოხდეს ხელით ან ავტომატურად.'
                    : 'Items purchased in the shop may be digital/in-game content. Orders may be processed manually or automatically.'}
                </p>
                <p className="text-muted-foreground">
                  {language === 'ka'
                    ? 'დაბრუნება/ანაზღაურება განიხილება ინდივიდუალურად — დაუკავშირდით მხარდაჭერას.'
                    : 'Refunds/returns are handled case-by-case — please contact support.'}
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold text-foreground">
                  {language === 'ka' ? 'აკრძალვები' : 'Prohibited behavior'}
                </h2>
                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                  <li>
                    {language === 'ka'
                      ? 'ჩეთ/ფორუმში შეურაცხყოფა, სიძულვილის ენა, სპამი.'
                      : 'Harassment, hate speech, or spam in chat/forums.'}
                  </li>
                  <li>
                    {language === 'ka'
                      ? 'ჩითები/ბაგების ბოროტად გამოყენება ან ექსპლოიტები.'
                      : 'Cheats, abuse of bugs, or exploits.'}
                  </li>
                  <li>
                    {language === 'ka'
                      ? 'სხვების ანგარიშზე წვდომის მცდელობა.'
                      : 'Attempting to access other users’ accounts.'}
                  </li>
                </ul>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold text-foreground">
                  {language === 'ka' ? 'პასუხისმგებლობის შეზღუდვა' : 'Limitation of liability'}
                </h2>
                <p className="text-muted-foreground">
                  {language === 'ka'
                    ? 'სერვისი მოწოდებულია „როგორც არის“. შეიძლება მოხდეს გათიშვები/განახლებები. მაქსიმალურად ვცდილობთ სტაბილურობას, მაგრამ 100% ხელმისაწვდომობას ვერ დავპირდებით.'
                    : 'The service is provided “as is”. Downtime/updates may occur. We aim for stability but cannot guarantee 100% uptime.'}
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold text-foreground">
                  {language === 'ka' ? 'მესამე მხარე' : 'Third-party'}
                </h2>
                <p className="text-muted-foreground">
                  {language === 'ka'
                    ? 'RageMC არ არის დაკავშირებული Mojang-ისა და Microsoft-ის კომპანიებთან.'
                    : 'RageMC is not affiliated with Mojang or Microsoft.'}
                </p>
              </section>

              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold text-foreground">
                  {language === 'ka' ? 'კონტაქტი' : 'Contact'}
                </h2>
                <p className="text-muted-foreground">
                  {language === 'ka'
                    ? 'დახმარებისთვის ან დავისთვის დაგვიკავშირდით Discord-ზე.'
                    : 'For support or disputes, contact us on Discord.'}
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

export default Terms;

