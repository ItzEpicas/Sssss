import React from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StaffApplicationSection from "@/components/StaffApplicationSection";

const StaffApplicationPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <StaffApplicationSection />
      </main>
      <Footer />
    </div>
  );
};

export default StaffApplicationPage;

