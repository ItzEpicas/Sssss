import React, { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Lock, Mail, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";

const AuthPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ email: "", password: "", confirmPassword: "", username: "" });
  const [loading, setLoading] = useState({ login: false, register: false });
  const { user, signIn, signUp } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [navigate, user]);

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setLoading((prev) => ({ ...prev, login: true }));
    const { error } = await signIn(loginForm.email.trim(), loginForm.password);

    if (error) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back",
        description: "You are now signed in.",
      });
      navigate("/");
    }

    setLoading((prev) => ({ ...prev, login: false }));
  };

  const handleSignUp = async (event: FormEvent) => {
    event.preventDefault();

    if (registerForm.password.length < 6) {
      toast({
        title: "Weak password",
        description: "Choose a password that is at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Make sure both password fields match.",
        variant: "destructive",
      });
      return;
    }

    setLoading((prev) => ({ ...prev, register: true }));

    const { error } = await signUp(
      registerForm.email.trim(),
      registerForm.password,
      registerForm.username.trim() || undefined,
    );

    if (error) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Check your inbox",
        description: "A confirmation email was sent. Please verify to finish registration.",
      });
      setActiveTab("login");
    }

    setLoading((prev) => ({ ...prev, register: false }));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 flex items-center justify-center">
          <Card className="w-full max-w-lg glass-card border-border/30">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center box-glow mb-3">
              <img
                src="/favicon.png"
                alt="RageMC"
                className="w-full h-full object-cover"
              />
            </div>
            <CardTitle className="text-2xl font-display">RageMC</CardTitle>
            <CardDescription>{t("hero.subtitle")}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "login" | "register")}> 
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{t("nav.login")}</TabsTrigger>
                <TabsTrigger value="register">{t("nav.register")}</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="pt-6">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="email@example.com"
                        value={loginForm.email}
                        onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginForm.password}
                        onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full gradient-primary" disabled={loading.login}>
                    {loading.login && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("nav.login")}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="pt-6">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-username"
                        type="text"
                        placeholder="YourUsername"
                        value={registerForm.username}
                        onChange={(event) => setRegisterForm({ ...registerForm, username: event.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="email@example.com"
                        value={registerForm.email}
                        onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="••••••••"
                        value={registerForm.password}
                        onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="••••••••"
                        value={registerForm.confirmPassword}
                        onChange={(event) => setRegisterForm({ ...registerForm, confirmPassword: event.target.value })}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full gradient-primary" disabled={loading.register}>
                    {loading.register && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("nav.register")}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>

          <CardFooter className="justify-center text-center text-sm text-muted-foreground">
            By creating an account you agree to our community rules.
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;
