import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ServerStatusCard from '@/components/ServerStatusCard';

const Server: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-16">
        <h1 className="font-display text-3xl font-black tracking-tight text-foreground md:text-4xl">
          Server
        </h1>
        <p className="mt-2 text-muted-foreground">
          Live status for <span className="font-mono">play.ragemc.ge</span>
        </p>

        <div className="mt-6">
          <ServerStatusCard />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Server;

