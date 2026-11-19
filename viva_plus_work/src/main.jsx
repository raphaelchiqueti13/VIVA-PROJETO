import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check,
  ChevronDown, ChevronRight, CircleHelp, Clock3, Droplet, Heart, HeartPulse,
  Home, LogIn, MapPin, Menu, ShieldCheck, Sparkles, Users, X, Award, Wallet,
  Building2, BarChart3, HandHeart, Bus, GraduationCap, Stethoscope, University, Ticket, LogOut, Settings, LockKeyhole, ClipboardCheck, Sun, Moon, Accessibility, Type, Contrast, Eye, RotateCcw, Copy, BadgeCheck, Lock
} from "lucide-react";
import RequirementsPage from "./Requirements";
import ImpactPage from "./Impact";
import { levels, benefits, benefitsFor, isUnlocked, levelByName } from "./benefits";
import { api, clearSession, getSavedUser, getToken, setSession, safeGet, safeSet } from "./api";
import "./style.css";

const fmtDate = (s) => s ? new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR") : "Não informado";
const formatNotificationTime = (value) => {
  if (!value) return "Agora";
  const normalized = String(value).includes("T") ? String(value) : String(value).replace(" ", "T") + "Z";
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? "Agora" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};
const today = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
})();
const bloodTypes = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];
const iconMap = { Bus, GraduationCap, HeartPulse, Stethoscope, University, Ticket, BadgeCheck };
function App() {
  const [user, setUser] = useState(getSavedUser());
  const [page, setPage] = useState(() => getSavedUser()?.role === "admin" ? "administracao" : "inicio");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modal, setModal] = useState("");
  const [returnToAuthAfterPrivacy, setReturnToAuthAfterPrivacy] = useState(false);
  const [toast, setToast] = useState("");
  const initialResetToken = new URLSearchParams(window.location.search).get("reset") || "";
  const [authMode, setAuthMode] = useState(initialResetToken ? "reset" : "login");
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [resetConfirm, setResetConfirm] = useState("");
  const [passwordChangeForm, setPasswordChangeForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", bloodType: "", region: "" });
  const [dashboard, setDashboard] = useState({ donations: [], donationCount: 0, level: "Iniciante", nextLevelAt: 1, appointments: [] });
  const [centers, setCenters] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const lastNotificationIdRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [apptForm, setApptForm] = useState({ hemocenterId: "", date: "", time: "" });
  const [appointmentSlots, setAppointmentSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ title: "", description: "", bloodType: "", region: "Nacional", startDate: today, endDate: today, hemocenterId: "" });
  const [search, setSearch] = useState("");
  const [preferences, setPreferences] = useState({ notificationCampaigns: true, notificationEligibility: true });
  const [theme, setTheme] = useState(() => safeGet("viva_theme") || "light");
  const [fontScale, setFontScale] = useState(() => { const saved = safeGet("viva_font_scale"); return !saved || saved === "100" ? "110" : saved; });
  const [highContrast, setHighContrast] = useState(() => safeGet("viva_high_contrast") === "true");
  const [reduceMotion, setReduceMotion] = useState(() => {
    const saved = safeGet("viva_reduce_motion");
    return saved === null ? window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false : saved === "true";
  });
  const [underlineLinks, setUnderlineLinks] = useState(() => safeGet("viva_underline_links") === "true");
  const [cookieChoice, setCookieChoice] = useState(() => safeGet("viva_cookie_preferences"));
  const notify = (msg) => { setToast(msg); window.setTimeout(() => setToast(""), 3500); };

  async function loadData(activeUser = user) {
    try {
      const c = await api("/hemocenters"); setCenters(c);
      if(getToken()){ const me=await api("/me"); setUser(me.user); setSession(getToken(),me.user); activeUser=me.user; }
      if (getToken()) {
        if (activeUser?.role === "donor") {
          const d = await api("/dashboard"); setDashboard(d);
          setPreferences({ notificationCampaigns: activeUser?.notificationCampaigns ?? true, notificationEligibility: activeUser?.notificationEligibility ?? true });
          const cs = await api("/campaigns"); setCampaigns(cs);
          try {
            const ns = await api("/notifications");
            setNotifications(ns.items || []);
            setUnreadNotifications(ns.unreadCount || 0);
          } catch (notificationError) {
            console.error("Não foi possível atualizar as notificações:", notificationError);
          }
        }
      }
    } catch (e) {
      if (/Sessão inválida|expirada/.test(e.message)) { clearSession(); setUser(null); notify("Sua sessão expirou. Faça login novamente."); }
      else notify(e.message);
    }
  }
  useEffect(() => { loadData(user); }, []);
  useEffect(() => {
    if (modal !== "appointment" || user?.role !== "donor" || !apptForm.hemocenterId || !apptForm.date) {
      setAppointmentSlots([]);
      setSlotsLoading(false);
      return;
    }
    let active = true;
    setSlotsLoading(true);
    api(`/appointments/availability?hemocenterId=${encodeURIComponent(apptForm.hemocenterId)}&date=${encodeURIComponent(apptForm.date)}`)
      .then(result => {
        if (!active) return;
        const slots = result.slots || [];
        setAppointmentSlots(slots);
        setApptForm(previous => {
          const selectedStillAvailable = slots.some(slot => slot.time === previous.time && slot.available);
          return { ...previous, time: selectedStillAvailable ? previous.time : (slots.find(slot => slot.available)?.time || "") };
        });
      })
      .catch(error => {
        if (active) {
          setAppointmentSlots([]);
          notify(error.message);
        }
      })
      .finally(() => { if (active) setSlotsLoading(false); });
    return () => { active = false; };
  }, [modal, user?.role, apptForm.hemocenterId, apptForm.date]);
  useEffect(() => { if (initialResetToken) setModal("auth"); }, []);
  useEffect(() => {
    if (user?.role !== "donor") return;
    const refreshDonorHistory = () => { if (document.visibilityState === "visible") loadData(user); };
    window.addEventListener("focus", refreshDonorHistory);
    document.addEventListener("visibilitychange", refreshDonorHistory);
    return () => { window.removeEventListener("focus", refreshDonorHistory); document.removeEventListener("visibilitychange", refreshDonorHistory); };
  }, [user?.id, user?.role]);
  useEffect(() => {
    if (user?.role !== "donor") {
      setNotifications([]);
      setUnreadNotifications(0);
      return;
    }
    let active = true;
    lastNotificationIdRef.current = null;
    const refresh = async () => {
      if (document.visibilityState !== "visible" || !getToken()) return;
      try {
        const result = await api("/notifications");
        if (active) {
          const items = result.items || [];
          const latestId = items.reduce((highest, item) => Math.max(highest, Number(item.id) || 0), 0);
          if (lastNotificationIdRef.current !== null && latestId > lastNotificationIdRef.current) {
            const newest = items.find(item => Number(item.id) > lastNotificationIdRef.current);
            if (newest) notify(`${newest.title}: ${newest.message}`);
          }
          lastNotificationIdRef.current = Math.max(lastNotificationIdRef.current || 0, latestId);
          setNotifications(items);
          setUnreadNotifications(result.unreadCount || 0);
        }
      } catch (error) {
        if (active && /Sessão inválida|expirada/.test(error.message)) {
          clearSession(); setUser(null);
        }
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 7000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user?.id, user?.role]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.fontScale = fontScale;
    root.dataset.highContrast = String(highContrast);
    root.dataset.reduceMotion = String(reduceMotion);
    root.dataset.underlineLinks = String(underlineLinks);
    safeSet("viva_theme", theme);
    safeSet("viva_font_scale", fontScale);
    safeSet("viva_high_contrast", String(highContrast));
    safeSet("viva_reduce_motion", String(reduceMotion));
    safeSet("viva_underline_links", String(underlineLinks));
  }, [theme, fontScale, highContrast, reduceMotion, underlineLinks]);
  useEffect(() => {
    const handleShortcut = (event) => {
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setModal(current => current === "accessibility" ? "" : "accessibility");
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3500); return () => clearTimeout(t); }, [toast]);

  // O widget oficial do VLibras é carregado automaticamente em todas as páginas.
  // O próprio widget fornece o controle flutuante necessário para iniciar uma tradução.
  useEffect(() => {
    if (document.getElementById("viva-vlibras-script")) return;
    const script = document.createElement("script");
    script.id = "viva-vlibras-script";
    script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  async function finishLogin(result) {
    setSession(result.token, result.user); setUser(result.user);
    setAuthForm({name:"",email:"",password:"",bloodType:"",region:""});
    setPage(result.user.role === "hemocenter" ? "atendimento" : result.user.role === "admin" ? "administracao" : "inicio");
    setModal("");
    await loadData(result.user);
    notify(`Bem-vindo${result.user.name ? ", " + result.user.name.split(" ")[0] : ""}!`);
  }
  async function submitAuth(e) {
    e.preventDefault(); setBusy(true);
    try {
      if (authMode === "forgot") {
        const result = await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: authForm.email }) });
        notify(result.message);
        setAuthMode("login");
        return;
      }
      if (authMode === "reset") {
        if (!resetToken) throw new Error("Link de redefinição inválido. Solicite um novo e-mail.");
        if (authForm.password !== resetConfirm) throw new Error("As senhas não coincidem.");
        const result = await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ token: resetToken, password: authForm.password }) });
        setResetToken(""); setResetConfirm("");
        clearSession(); setUser(null); setPage("inicio");
        const cleanUrl = new URL(window.location.href); cleanUrl.searchParams.delete("reset");
        window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
        setAuthForm({ name: "", email: authForm.email, password: "", bloodType: "", region: "" });
        setAuthMode("login");
        notify(result.notificationSent ? "Senha alterada. Um alerta de segurança foi enviado ao seu e-mail. Entre novamente." : result.message);
        return;
      }
      const result = await api(authMode === "login" ? "/auth/login" : "/auth/register", { method: "POST", body: JSON.stringify(authForm) });
      await finishLogin(result);
    } catch (e) { notify(e.message); }
    finally { setBusy(false); }
  }
  async function changePassword(e) {
    e.preventDefault();
    if (passwordChangeForm.newPassword !== passwordChangeForm.confirmPassword) return notify("A confirmação da nova senha não confere.");
    setBusy(true);
    try {
      const result = await api("/me/password", { method: "PATCH", body: JSON.stringify({ currentPassword: passwordChangeForm.currentPassword, newPassword: passwordChangeForm.newPassword }) });
      clearSession(); setUser(null); setPage("inicio");
      setPasswordChangeForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      notify(result.notificationSent ? "Senha alterada. As outras sessões foram encerradas e um alerta foi enviado por e-mail. Entre novamente." : "Senha alterada. As outras sessões foram encerradas. Entre novamente com a nova senha.");
    } catch (e) { notify(e.message); }
    finally { setBusy(false); }
  }
  async function loginDemo(email) {
    setBusy(true);
    try {
      const result = await api("/auth/login", { method:"POST", body:JSON.stringify({email,password:"Demo@12345678"}) });
      await finishLogin(result);
    } catch (e) { notify(`${e.message} Rode npm run demo:setup no terminal antes da apresentação.`); }
    finally { setBusy(false); }
  }
  function logout() { setAuthForm({name:"",email:"",password:"",bloodType:"",region:""}); setCampaigns([]); setNotifications([]); setUnreadNotifications(0); clearSession(); setUser(null); setPage("inicio"); setDashboard({ donations: [], donationCount: 0, level: "Iniciante", nextLevelAt: 1, appointments: [] }); notify("Você saiu da sua conta."); }
  function go(next) { setPage(next); setMobileOpen(false); if (next === "agendar") setModal("appointment"); }
  async function book(e) {
    e.preventDefault();
    if (!apptForm.time || !appointmentSlots.some(slot => slot.time === apptForm.time && slot.available)) {
      notify("Escolha um horário que esteja disponível.");
      return;
    }
    setBusy(true);
    try {
      const result = await api("/appointments", { method: "POST", body: JSON.stringify(apptForm) });
      await loadData();
      setModal("");
      notify(result.message || "Agendamento confirmado no VIVA+!");
    } catch (e) {
      notify(e.message);
      // Se outra pessoa reservar o horário primeiro, atualiza a lista sem fechar a janela.
      if (apptForm.hemocenterId && apptForm.date) {
        try {
          const fresh = await api(`/appointments/availability?hemocenterId=${encodeURIComponent(apptForm.hemocenterId)}&date=${encodeURIComponent(apptForm.date)}`);
          const slots = fresh.slots || [];
          setAppointmentSlots(slots);
          setApptForm(previous => ({ ...previous, time: slots.some(slot => slot.time === previous.time && slot.available) ? previous.time : (slots.find(slot => slot.available)?.time || "") }));
        } catch {}
      }
    } finally { setBusy(false); }
  }
  async function cancelAppointment(id) {
    try { await api(`/appointments/${id}/cancel`, { method: "PATCH" }); await loadData(); notify("Agendamento cancelado."); }
    catch(e) { notify(e.message); }
  }
  async function savePreferences(e) {
    e.preventDefault();
    try {
      const r = await api("/me/preferences", { method:"PATCH", body: JSON.stringify(preferences) });
      setUser(r.user); setSession(getToken(),r.user); notify("Preferências atualizadas.");
    } catch(e) { notify(e.message); }
  }
  async function markNotificationRead(id) {
    try {
      await api(`/notifications/${id}/read`, { method: "PATCH" });
      setNotifications(current => current.map(item => item.id === id ? { ...item, readAt: item.readAt || new Date().toISOString() } : item));
      setUnreadNotifications(current => Math.max(0, current - 1));
    } catch (error) { notify(error.message); }
  }
  async function openNotification(item) {
    // Abrir/ler uma notificação nunca muda de página. A navegação ocorre
    // exclusivamente pelo menu lateral, quando o usuário escolher fazê-la.
    if (!item.readAt) await markNotificationRead(item.id);
  }
  async function refreshNotifications() {
    try {
      const result = await api("/notifications");
      setNotifications(result.items || []);
      setUnreadNotifications(result.unreadCount || 0);
    } catch (error) { notify(error.message); }
  }
  async function markAllNotificationsRead() {
    try {
      await api("/notifications/read-all", { method: "PATCH" });
      setNotifications(current => current.map(item => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      setUnreadNotifications(0);
    } catch (error) { notify(error.message); }
  }

  async function createCampaign(e) {
    e.preventDefault(); setBusy(true);
    try { await api("/admin/campaigns",{method:"POST",body:JSON.stringify(campaignForm)}); await loadData(); notify("Campanha criada."); setCampaignForm({...campaignForm,title:"",description:""}); }
    catch(e) { notify(e.message); } finally { setBusy(false); }
  }


  const donorNav = [
    { id:"inicio", label:"Visão geral", icon:Home },
    { id:"notificacoes", label:"Notificações", icon:Bell },
    { id:"impacto", label:"Impacto", icon:BarChart3 },
    { id:"carteira", label:"Minha carteira", icon:Wallet },
    { id:"campanhas", label:"Campanhas", icon:HeartPulse },
    { id:"propostas", label:"Propostas e benefícios", icon:HandHeart },
    { id:"requisitos", label:"Requisitos para doar", icon:ClipboardCheck },
    { id:"hemocentros", label:"Hemocentros", icon:MapPin },
    { id:"agendamentos", label:"Agendamentos", icon:CalendarDays },
    { id:"selos", label:"Meus selos", icon:Award },
  ];
  const nav = user?.role === "donor" ? donorNav : !user ? donorNav.filter(item => item.id !== "notificacoes") : user?.role === "admin" ? [{id:"administracao",label:"Gestão administrativa",icon:Settings}] : [];
  const filteredCenters = centers.filter(c => `${c.name} ${c.region} ${c.address}`.toLowerCase().includes(search.toLowerCase()));
  const count = dashboard.donationCount || 0;
  const nextLevel = levels.find(l => count < l.count) || null;
  const progress = nextLevel ? Math.min(100, count / nextLevel.count * 100) : 100;

  if (user?.role === "hemocenter") return <StaffWorkspace user={user} onLogout={logout} notify={notify}/>;

  return <div className={`app-shell ${user?.role === "admin" ? "admin-shell" : ""}`}>
    <a className="skip-link" href="#main-content">Pular para o conteúdo principal</a>
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <button className="brand" type="button" onClick={() => go("inicio")}><span className="brand-mark"><Droplet size={23} fill="currentColor"/></span><span>VIVA<span className="brand-plus">+</span><small>CARTEIRA DO DOADOR</small></span></button>
      {user?.role !== "admin" && <div className="side-label">MENU PRINCIPAL</div>}
      <nav>{nav.map(n => <button key={n.id} className={`nav-item ${page===n.id ? "active" : ""}`} aria-current={page===n.id ? "page" : undefined} onClick={() => go(n.id)}><n.icon size={18}/><span>{n.label}</span>{page===n.id && <ChevronRight size={15} className="nav-arrow"/>}</button>)}</nav>
      {user?.role === "hemocenter" && <><div className="side-label side-label-spaced">ATENDIMENTO</div><button className="nav-item active"><ClipboardCheck size={18}/><span>Validar carteira</span></button></>}
      {user?.role !== "admin" && <div className="sidebar-bottom"><div className="help-card"><span className="help-icon"><Heart size={17}/></span><strong>Uma doação pode salvar até 4 vidas.</strong><p>Obrigado por fazer parte dessa corrente.</p><button onClick={() => setModal("about")}>Conheça o VIVA+ <ArrowRight size={14}/></button></div><div className="side-footer"><ShieldCheck size={14}/> Seus dados merecem cuidado</div></div>}
      {user?.role === "admin" && <div className="sidebar-bottom"><div className="side-footer"><ShieldCheck size={14}/> Ambiente administrativo</div></div>}
    </aside>
    {mobileOpen && <div className="mobile-scrim" onClick={() => setMobileOpen(false)} />}
    <main className="main-area" id="main-content" tabIndex="-1">
      <header className="topbar">
        <button className="mobile-menu icon-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={mobileOpen}>{mobileOpen?<X/>:<Menu/>}</button>
        <div className="breadcrumb">VIVA+ <ChevronRight size={14}/> <span>{nav.find(n=>n.id===page)?.label || (page==="institucional"?"Painel institucional":"Configurações")}</span></div>
        <div className="top-actions"><span className="secure-chip"><ShieldCheck size={14}/> Conexão protegida</span>{user?.email?.endsWith("@demo.viva")&&<span className="demo-session-chip"><Sparkles size={13}/> DADOS DE DEMONSTRAÇÃO</span>}
          <button className="icon-button theme-switch" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-pressed={theme === "dark"} aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"} title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}>{theme === "dark" ? <Sun size={18}/> : <Moon size={18}/>}</button>
          {user ? <>{user.role === "donor" && <button type="button" className="icon-button notification" title="Abrir central de notificações" aria-label={`Abrir notificações${unreadNotifications ? `, ${unreadNotifications} não lidas` : ""}`} onClick={()=>{go("notificacoes");refreshNotifications();}}>
              <Bell size={18}/>{unreadNotifications>0&&<span className="notification-count">{unreadNotifications>99?"99+":unreadNotifications}</span>}
            </button>}<button className="profile-button" onClick={()=>user.role==="admin"?logout():setModal("profile")}><span className="avatar">{user.name?.charAt(0).toUpperCase()}</span><span className="profile-text"><b>{user.name?.split(" ")[0]}</b><small>{user.role==="donor"?"Doador":"Administrador"}</small></span>{user.role==="admin"?<LogOut size={15}/>:<ChevronDown size={15}/>}</button></> : <button className="btn btn-primary btn-small" onClick={()=>{setAuthMode("login");setModal("auth")}}><LogIn size={16}/> Entrar</button>}
        </div>
      </header>
      <div className="page-content">
        {user?.role === "admin" ? <AdminManagement centers={centers} onRefresh={loadData} campaignForm={campaignForm} setCampaignForm={setCampaignForm} createCampaign={createCampaign} busy={busy}/> : null}
        {user?.role !== "admin" && page==="inicio" && <HomePage user={user} dashboard={dashboard} count={count} nextLevel={nextLevel} progress={progress} campaigns={campaigns} centers={centers} onNavigate={go} onAuth={()=>{setAuthMode("register");setModal("auth")}} onBook={()=>user?setModal("appointment"):(setAuthMode("login"),setModal("auth"))}/>}
        {user?.role === "donor" && page==="notificacoes" && <NotificationsPage items={notifications} unreadCount={unreadNotifications} onOpen={openNotification} onMarkAllRead={markAllNotificationsRead} onRefresh={refreshNotifications}/>}
        {user?.role !== "admin" && page==="carteira" && <WalletPage user={user} dashboard={dashboard} count={count} onAuth={()=>{setAuthMode("login");setModal("auth")}}/>}
        {user?.role !== "admin" && page==="campanhas" && <CampaignPage user={user} campaigns={campaigns} onAuth={()=>{setAuthMode("login");setModal("auth")}} onBook={()=>user?setModal("appointment"):(setAuthMode("login"),setModal("auth"))}/> }
        {user?.role !== "admin" && page==="propostas" && <ProposalsPage user={user} count={count} dashboard={dashboard} onAuth={()=>{setAuthMode("register");setModal("auth")}} onNavigate={go}/>}
        {user?.role !== "admin" && page==="impacto" && <ImpactPage onAuth={()=>{setAuthMode("register");setModal("auth")}} onNavigate={go}/>}
        {user?.role !== "admin" && page==="requisitos" && <RequirementsPage onBook={()=>user?setModal("appointment"):(setAuthMode("login"),setModal("auth"))}/>}
        {user?.role !== "admin" && page==="hemocentros" && <CentersPage centers={filteredCenters} search={search} setSearch={setSearch} notify={notify}/>}
        {user?.role !== "admin" && page==="agendamentos" && <AppointmentsPage user={user} appointments={dashboard.appointments} onBook={()=>user?setModal("appointment"):(setAuthMode("login"),setModal("auth"))} onCancel={cancelAppointment} onAuth={()=>{setAuthMode("login");setModal("auth")}}/>}
        {user?.role !== "admin" && page==="selos" && <BadgesPage count={count} onNavigate={go}/>}
        {user?.role !== "admin" && page==="configuracoes" && <SettingsPage user={user} preferences={preferences} setPreferences={setPreferences} onSubmit={savePreferences} passwordChangeForm={passwordChangeForm} setPasswordChangeForm={setPasswordChangeForm} onChangePassword={changePassword} busy={busy} onAuth={()=>{setAuthMode("login");setModal("auth")}}/>}
        {user?.role !== "admin" && <footer className="page-footer"><span>© 2026 VIVA+ · Plataforma acadêmica independente.</span><span className="footer-legal"><button type="button" onClick={()=>{setReturnToAuthAfterPrivacy(false);setModal("privacy")}}>Privacidade</button><button type="button" onClick={()=>setModal("terms")}>Termos de uso</button><button type="button" onClick={()=>setModal("cookies")}>Cookies</button><span><LockKeyhole size={13}/> Privacidade em primeiro lugar</span></span></footer>}
      </div>
    </main>
    <div className="accessibility-floats" aria-label="Ferramentas de acessibilidade">
      <button type="button" className="floating-a11y-button" onClick={() => setModal("accessibility")} aria-label="Abrir opções de acessibilidade" title="Acessibilidade">
        <Accessibility size={25} strokeWidth={2.4}/>
      </button>
    </div>
    <div vw="enabled" className="enabled viva-vlibras" aria-label="Tradutor oficial VLibras">
      <div vw-access-button="active" className="active"></div>
      <div vw-plugin-wrapper><div className="vw-plugin-top-wrapper"></div></div>
    </div>
    {!cookieChoice && <section className="cookie-banner" role="region" aria-label="Preferências de cookies"><div><b>Privacidade e cookies</b><p>Usamos armazenamento local necessário para manter sua sessão e preferências. Não identificamos ferramentas de publicidade ou analytics neste projeto. Você pode revisar suas escolhas a qualquer momento.</p></div><div className="cookie-actions"><button className="btn btn-secondary btn-small" onClick={()=>setModal("cookies")}>Personalizar</button><button className="btn btn-primary btn-small" onClick={()=>{const v={essential:true,analytics:false,updatedAt:new Date().toISOString()};safeSet("viva_cookie_preferences",JSON.stringify(v));setCookieChoice(JSON.stringify(v));}}>Aceitar necessários</button></div></section>}
    {toast && <div className="toast" role="status" aria-live="polite" aria-atomic="true"><span><Check size={16}/></span>{toast}</div>}
    {modal==="accessibility" && <Modal title="Acessibilidade" subtitle="Personalize a leitura e a aparência do VIVA+. Atalho: Alt + Shift + A." onClose={()=>setModal("")}>
      <div className="a11y-settings">
        <section className="a11y-setting" aria-labelledby="a11y-theme-label">
          <div className="a11y-label-row"><Sun size={17}/><div><h3 id="a11y-theme-label">Aparência</h3><p>Escolha o tema mais confortável para você.</p></div></div>
          <div className="a11y-segmented" role="group" aria-label="Tema de cores">
            <button type="button" aria-pressed={theme==="light"} className={theme==="light"?"selected":""} onClick={()=>setTheme("light")}><Sun size={16}/> Claro</button>
            <button type="button" aria-pressed={theme==="dark"} className={theme==="dark"?"selected":""} onClick={()=>setTheme("dark")}><Moon size={16}/> Escuro</button>
          </div>
        </section>
        <section className="a11y-setting" aria-labelledby="a11y-font-label">
          <div className="a11y-label-row"><Type size={17}/><div><h3 id="a11y-font-label">Tamanho do texto</h3><p>Amplie os textos e controles da interface.</p></div></div>
          <div className="a11y-font-controls"><button type="button" className="font-step" disabled={fontScale==="100"} onClick={()=>setFontScale(v=>({"150":"125","125":"110","110":"100","100":"100"}[v]||"100"))} aria-label="Diminuir tamanho do texto">A−</button><output aria-live="polite">{fontScale}%</output><button type="button" className="font-step" disabled={fontScale==="150"} onClick={()=>setFontScale(v=>({"100":"110","110":"125","125":"150","150":"150"}[v]||"110"))} aria-label="Aumentar tamanho do texto">A+</button></div>
        </section>
        <section className="a11y-setting" aria-labelledby="a11y-visual-label">
          <div className="a11y-label-row"><Contrast size={17}/><div><h3 id="a11y-visual-label">Preferências visuais</h3><p>As escolhas são guardadas neste navegador.</p></div></div>
          <label className="a11y-toggle"><span><b>Alto contraste</b><small>Reforça bordas, textos e estados de foco.</small></span><input type="checkbox" checked={highContrast} onChange={e=>setHighContrast(e.target.checked)}/></label>
          <label className="a11y-toggle"><span><b>Reduzir animações</b><small>Minimiza transições e movimento na interface.</small></span><input type="checkbox" checked={reduceMotion} onChange={e=>setReduceMotion(e.target.checked)}/></label>
          <label className="a11y-toggle"><span><b>Sublinhar links</b><small>Ajuda a diferenciar links do texto comum.</small></span><input type="checkbox" checked={underlineLinks} onChange={e=>setUnderlineLinks(e.target.checked)}/></label>
        </section>
        <div className="a11y-help"><Eye size={16}/><p>Também é possível navegar usando a tecla Tab, ativar controles com Enter ou Espaço e usar um leitor de tela. O atalho <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>A</kbd> abre este painel.</p></div>
        <button className="btn btn-secondary btn-full" type="button" onClick={()=>{setTheme("light");setFontScale("100");setHighContrast(false);setReduceMotion(false);setUnderlineLinks(false);}}> <RotateCcw size={15}/> Restaurar preferências padrão</button>
      </div>
    </Modal>}
    {modal==="privacy" && <Modal title="Política de privacidade" subtitle="Informações sobre o tratamento de dados no protótipo VIVA+." onClose={()=>{setModal(returnToAuthAfterPrivacy?"auth":"");setReturnToAuthAfterPrivacy(false)}}><LegalPrivacy/></Modal>}
    {modal==="terms" && <Modal title="Termos de uso" subtitle="Condições de utilização e limites da plataforma." onClose={()=>setModal("")}><LegalTerms/></Modal>}
    {modal==="cookies" && <Modal title="Preferências de cookies e armazenamento" subtitle="Controle o uso de tecnologias não essenciais." onClose={()=>setModal("")}><div className="legal-copy"><p><b>Necessários:</b> armazenamento local para manter a sessão e as preferências da interface. São essenciais ao funcionamento e não podem ser desativados neste painel.</p><label className="a11y-toggle"><span><b>Medição/analytics</b><small>Atualmente não há ferramenta de analytics ou publicidade identificada no código. Se uma ferramenta for adicionada futuramente, deverá respeitar esta escolha.</small></span><input type="checkbox" checked={false} disabled aria-label="Analytics não está instalado"/></label><p>O projeto usa localStorage no navegador para token de sessão e preferências. Isso não é, tecnicamente, um cookie HTTP. Não há cookies não essenciais ativos identificados na auditoria estática.</p><div className="cookie-actions"><button className="btn btn-secondary" onClick={()=>{const v={essential:true,analytics:false,updatedAt:new Date().toISOString()};safeSet("viva_cookie_preferences",JSON.stringify(v));setCookieChoice(JSON.stringify(v));setModal("");}}>Somente necessários</button><button className="btn btn-primary" onClick={()=>{const v={essential:true,analytics:false,updatedAt:new Date().toISOString()};safeSet("viva_cookie_preferences",JSON.stringify(v));setCookieChoice(JSON.stringify(v));setModal("");}}>Salvar preferências</button></div></div></Modal>}
    {modal==="auth" && <Modal title={authMode==="login"?"Que bom ter você de volta":authMode==="register"?"Crie sua conta VIVA+":authMode==="forgot"?"Recuperar acesso":"Criar nova senha"} subtitle={authMode==="login"?"Entre para acessar sua carteira digital.":authMode==="register"?"Comece sua jornada de solidariedade.":authMode==="forgot"?"Solicite um link temporário. Por segurança, não informamos se o endereço está cadastrado.":"Escolha uma senha nova para sua conta."} onClose={()=>setModal("")}>
      <form className="form-stack" onSubmit={submitAuth}>
        {authMode==="register" && <>
          <Field label="Nome completo"><input required minLength="2" autoComplete="name" placeholder="Nome e sobrenome" value={authForm.name} onChange={e=>setAuthForm({...authForm,name:e.target.value})}/></Field>
          <Field label="Tipo sanguíneo (opcional)"><select value={authForm.bloodType} onChange={e=>setAuthForm({...authForm,bloodType:e.target.value})}><option value="">Não sei / prefiro não informar</option>{bloodTypes.map(t=><option key={t} value={t}>{t}</option>)}</select></Field>
          <p className="form-note"><ShieldCheck size={15}/> O tipo sanguíneo é autodeclarado no cadastro e não será exibido como validado até confirmação por instituição parceira.</p>
          <Field label="Região de atendimento (opcional)"><select value={authForm.region} onChange={e=>setAuthForm({...authForm,region:e.target.value})}><option value="">Prefiro não informar</option>{["Centro","Zona Leste","Zona Norte","Zona Sul","Zona Oeste","Nacional","Outra região"].map(r=><option key={r}>{r}</option>)}</select></Field>
          <p className="form-note"><ShieldCheck size={15}/> Os dados básicos são usados para criar a conta e operar a carteira, campanhas e solicitações no VIVA+. Tipo sanguíneo e região são opcionais; o tipo sanguíneo é autodeclarado. <button type="button" className="inline-privacy-link" onClick={()=>{setReturnToAuthAfterPrivacy(true);setModal("privacy")}}>Leia a política de privacidade</button>. Não informe dados clínicos adicionais ou documentos pessoais neste protótipo.</p>
        </>}
        {authMode!=="reset" && <Field label="E-mail"><input required type="email" autoComplete="email" placeholder="voce@exemplo.com" value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})}/></Field>}
        {(authMode==="login"||authMode==="register"||authMode==="reset") && <Field label={authMode==="reset"?"Nova senha":"Senha"}><input required type="password" minLength={authMode==="login"?1:10} autoComplete={authMode==="login"?"current-password":"new-password"} placeholder={authMode==="login"?"Sua senha":"Mínimo de 10 caracteres"} value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})}/></Field>}
        {authMode==="reset" && <Field label="Confirme a nova senha"><input required type="password" minLength="10" autoComplete="new-password" placeholder="Digite novamente a nova senha" value={resetConfirm} onChange={e=>setResetConfirm(e.target.value)}/></Field>}
        <button className="btn btn-primary btn-full" disabled={busy}>{busy?"Aguarde…":authMode==="login"?"Entrar na minha conta":authMode==="register"?"Criar minha conta":authMode==="forgot"?"Enviar link de recuperação":"Salvar nova senha"} <ArrowRight size={16}/></button>
        {authMode==="login" && <p className="switch-auth"><button type="button" onClick={()=>setAuthMode("forgot")}>Esqueci minha senha</button></p>}
        <p className="switch-auth">{authMode==="login"?"Ainda não tem uma conta?":authMode==="register"?"Já tem uma conta?":authMode==="forgot"?"Lembrou sua senha?":"Deseja voltar?"} <button type="button" onClick={()=>{setAuthMode(authMode==="login"?"register":"login");setAuthForm({...authForm,password:""});setResetConfirm("")}}>{authMode==="login"?"Cadastre-se":"Entrar"}</button></p>
      </form>
      {authMode === "login" && import.meta.env.DEV && <section className="demo-access-panel" aria-label="Acesso rápido para demonstração"><div><b>Acesso de demonstração</b><small>Contas fictícias locais. Rode <code>npm run demo:setup</code> uma vez antes de usar.</small></div><div className="demo-access-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>loginDemo("doador@demo.viva")}><Users size={15}/> Entrar como doador</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>loginDemo("hemocentro@demo.viva")}><Building2 size={15}/> Entrar como funcionário</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>loginDemo("admin@demo.viva")}><Settings size={15}/> Entrar como administrador</button></div><small>Senha das duas contas: <code>Demo@12345678</code>. Dados fictícios, somente para apresentação.</small></section>}
    </Modal>}
    {modal==="appointment" && <Modal title="Agendar doação" subtitle="Consulte os horários livres e confirme sua reserva na hora." onClose={()=>setModal("")}>
      {!user ? <div className="empty-state"><LockKeyhole/><p>Entre na sua conta para criar um agendamento.</p><button className="btn btn-primary" onClick={()=>{setModal("auth");setAuthMode("login")}}>Entrar</button></div> : <form className="form-stack" onSubmit={book}>
        {centers.length===0&&<div className="notice-box"><b>Nenhuma unidade verificada disponível</b><p>O administrador precisa cadastrar uma unidade com fonte oficial antes de receber reservas.</p></div>}
        <Field label="Hemocentro"><select required value={apptForm.hemocenterId} onChange={e=>setApptForm({...apptForm,hemocenterId:e.target.value,time:""})}><option value="">Selecione uma unidade</option>{centers.map(c=><option value={c.id} key={c.id}>{c.name} — {c.region}</option>)}</select></Field>
        <Field label="Data"><input type="date" required min={today} value={apptForm.date} onChange={e=>setApptForm({...apptForm,date:e.target.value,time:""})}/></Field>
        <Field label="Horários disponíveis"><select required value={apptForm.time} disabled={slotsLoading||!apptForm.hemocenterId||!apptForm.date||appointmentSlots.length===0} onChange={e=>setApptForm({...apptForm,time:e.target.value})}>
          <option value="">{slotsLoading?"Consultando disponibilidade…":!apptForm.hemocenterId||!apptForm.date?"Selecione a unidade e a data":appointmentSlots.some(slot=>slot.available)?"Selecione um horário livre":"Nenhum horário disponível"}</option>
          {appointmentSlots.map(slot=><option key={slot.time} value={slot.time} disabled={!slot.available}>{slot.time} — {slot.available?"Disponível":slot.reason==="booked"?"Ocupado":"Indisponível"}</option>)}
        </select></Field>
        {apptForm.hemocenterId&&apptForm.date&&<p className="form-note"><CalendarDays size={15}/>{slotsLoading?"Consultando vagas…":`${appointmentSlots.filter(slot=>slot.available).length} horário(s) livre(s) nesta unidade para a data selecionada.`}</p>}
        <p className="form-note"><CircleHelp size={15}/> Ao confirmar, a vaga fica reservada imediatamente na agenda do VIVA+. Esta reserva não sincroniza com sistemas externos da unidade e não substitui a triagem de saúde presencial.</p>
        <button className="btn btn-primary btn-full" disabled={busy||slotsLoading||!apptForm.time||!appointmentSlots.some(slot=>slot.time===apptForm.time&&slot.available)}>{busy?"Confirmando…":"Confirmar agendamento"} <ArrowRight size={16}/></button>
      </form>}
    </Modal>}
    {modal==="profile" && <Modal title="Sua conta" subtitle="Informações de acesso e atalhos." onClose={()=>setModal("")}>
      <div className="profile-modal"><div className="avatar avatar-large">{user?.name?.charAt(0).toUpperCase()}</div><h3>{user?.name}</h3><p>{user?.email}</p><span className="role-tag">{user?.role==="donor"?"Doador":user?.role==="admin"?"Administrador":"Hemocentro"}</span></div>
      <button className="settings-link" onClick={()=>{setModal("");go("configuracoes")}}><Settings size={17}/> Preferências e notificações <ChevronRight size={16}/></button>
      <button className="settings-link logout-link" onClick={()=>{setModal("");logout()}}><LogOut size={17}/> Sair da conta <ChevronRight size={16}/></button>
    </Modal>}
    {modal==="about" && <Modal title="Tecnologia que transforma solidariedade" subtitle="Conheça a proposta VIVA+." onClose={()=>{setModal("");setAuthForm(f=>({...f,email:"",password:""}));}}><p className="about-copy">O VIVA+ propõe uma infraestrutura digital para mobilizar, reconhecer e medir a participação cidadã em torno da doação de sangue. Reúne carteira digital, histórico validado por hemocentros, campanhas, agendamento e dados agregados para planejamento.</p><div className="about-points"><span><ShieldCheck/> Segurança e privacidade</span><span><Heart/> Selos que desbloqueiam propostas de benefício</span><span><Users/> Integração institucional planejada</span></div><div className="notice-box">O VIVA+ é uma plataforma acadêmica independente. As unidades exibidas precisam ter fonte oficial cadastrada; campanhas, solicitações e indicadores são registros internos. Os benefícios ligados aos selos são propostas: não há integração automática com sistemas clínicos, Gov.br, transporte ou benefícios públicos.</div></Modal>}
  </div>;
}

function LegalPrivacy(){return <div className="legal-copy"><p><b>Versão informativa — 13/11/2026.</b> Este texto descreve o comportamento identificado no código entregue. Deve ser revisado pelo responsável pelo projeto e por assessoria jurídica antes de uso público com dados reais.</p><h3>Quem é responsável?</h3><p>O material recebido não identifica razão social, CNPJ, endereço, encarregado de dados ou canal institucional formal. Por isso, esta versão não atribui esses dados a qualquer pessoa ou organização. Antes da operação, o controlador deve ser identificado e disponibilizar canal para solicitações dos titulares.</p><h3>Dados tratados e finalidades observadas</h3><p>O cadastro público atual coleta nome, e-mail e senha (armazenada como hash). Tipo sanguíneo e região são opcionais. A aplicação também registra autenticação, preferências de notificações, solicitações de agendamento e registros internos de doação validados por perfil institucional. Esses dados viabilizam a conta, a carteira, a segmentação das campanhas, a reserva interna de horários e o histórico interno. O banco ainda conserva colunas legadas de telefone, data de nascimento, cidade e preferência de Libras, mas elas não são solicitadas no cadastro público desta versão.</p><p>Tipo sanguíneo e registros relacionados à doação podem constituir dados pessoais sensíveis referentes à saúde. O tipo sanguíneo informado no cadastro é autodeclarado e não equivale a validação clínica. Não informe dados reais neste protótipo até que controlador, base legal, necessidade, segurança e governança sejam formalmente definidos.</p><h3>Base legal, compartilhamento e retenção</h3><p>A base legal aplicável a cada finalidade não pode ser presumida por este protótipo. Deve ser definida pelo controlador conforme a LGPD, especialmente para dados sensíveis. O código prevê acesso por perfis de administrador e por perfis institucionais a registros vinculados à unidade; não documenta contratos, operadores, transferências internacionais, prazos de retenção, política de backup ou processo completo de atendimento aos direitos dos titulares. Esses pontos exigem definição antes da operação.</p><h3>Ferramenta externa de acessibilidade</h3><p>O site carrega o widget VLibras, disponibilizado pelo Governo Federal, por meio de um script hospedado em vlibras.gov.br; o widget também pode carregar fontes por cdn.jsdelivr.net. O recurso é oferecido para tradução de conteúdo em português para Libras. Ao usar o tradutor, o texto selecionado é processado pelo serviço externo. Consulte também o <a href="https://www.vlibras.gov.br/privacy.html" target="_blank" rel="noreferrer">aviso de privacidade oficial do VLibras</a>. O VIVA+ não controla a disponibilidade ou as práticas operacionais desse serviço.</p><h3>Armazenamento e segurança</h3><p>As preferências e o token de sessão são armazenados no navegador via localStorage; a API usa JWT com expiração. Uma falha de script no navegador pode expor tokens mantidos nesse armazenamento. Há hash de senha, controle de perfis, logs administrativos e cabeçalhos de segurança, mas esses controles não representam garantia de segurança. Recomenda-se migrar para sessão com cookie HttpOnly/Secure/SameSite e proteção CSRF, após testes de compatibilidade.</p><h3>Direitos dos titulares e contato</h3><p>O titular deve dispor de processo para solicitar confirmação, acesso, correção, informação, oposição quando cabível, portabilidade nos termos aplicáveis e eliminação, observadas as hipóteses legais de conservação. Ainda é necessário implementar um canal e processo operacional para essas solicitações. Não foi fornecido contato institucional verificável; o responsável pelo projeto deve preencher este item com canal válido antes da publicação. Não envie documentos ou dados de saúde por canais informais.</p></div>}
function LegalTerms(){return <div className="legal-copy"><p><b>Versão informativa — 13/11/2026.</b> Termos preliminares para protótipo acadêmico, sujeitos a validação jurídica e identificação do fornecedor.</p><h3>Natureza do serviço</h3><p>O VIVA+ é uma aplicação acadêmica independente para demonstração de carteira digital, campanhas, reservas internas de agendamento e registros internos. Não é órgão público, hemocentro, serviço oficial de hemoterapia ou prontuário.</p><h3>Limites importantes</h3><p>A carteira e o código temporário confirmam apenas que a consulta foi emitida pelo próprio VIVA+. Não comprovam identidade civil, aptidão clínica, elegibilidade para doação ou validade perante sistemas externos. Reservas de agendamento são confirmadas imediatamente na agenda interna do VIVA+, mas não sincronizam com sistemas externos de hemocentros. A triagem e a decisão clínica cabem exclusivamente à equipe de saúde competente.</p><h3>Responsabilidades</h3><p>O usuário deve fornecer informações corretas, proteger suas credenciais e não utilizar a plataforma para fraude, assédio, acesso indevido ou divulgação de dados de terceiros. Perfis institucionais devem acessar somente dados necessários às atividades autorizadas e manter sigilo. Administradores devem cadastrar unidades e fontes oficiais após conferência.</p><h3>Disponibilidade e alterações</h3><p>O serviço é fornecido como protótipo, podendo sofrer alterações, interrupções ou indisponibilidade. Não há promessa de integração com Gov.br, prontuários, transporte, benefícios públicos, hemocentros ou serviços de mensagens. Benefícios descritos como propostas não são garantidos nem constituem parceria confirmada.</p><h3>Pagamentos e reembolsos</h3><p>Na análise do código entregue não foi identificada funcionalidade de cobrança, assinatura ou pagamento. Portanto, não se aplica política de reembolso nesta versão.</p><h3>Contato e foro</h3><p>O responsável legal, dados empresariais, canal de atendimento e condições definitivas devem ser informados pelo mantenedor e validados juridicamente antes de disponibilização pública. Nenhum CNPJ, endereço ou foro específico foi presumido neste documento.</p></div>}

function Field({label,children}) { return <label className="field"><span>{label}</span>{children}</label>; }
function Modal({title,subtitle,onClose,children}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = React.useId();
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector("button, input, select, textarea, [href], [tabindex]:not([tabindex='-1'])");
    first?.focus();
    const keyHandler = (event) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); }
      if (event.key === "Tab" && dialog) {
        const focusables = [...dialog.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex='-1'])")].filter(el => !el.hasAttribute("hidden"));
        if (!focusables.length) return;
        const firstEl = focusables[0], lastEl = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === firstEl) { event.preventDefault(); lastEl.focus(); }
        else if (!event.shiftKey && document.activeElement === lastEl) { event.preventDefault(); firstEl.focus(); }
      }
    };
    document.addEventListener("keydown", keyHandler);
    return () => { document.removeEventListener("keydown", keyHandler); previous?.focus?.(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal-card" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}><button className="modal-close icon-button" onClick={onClose} aria-label="Fechar janela"><X size={19}/></button><div className="modal-head"><span className="modal-mark"><Droplet fill="currentColor"/></span><h2 id={titleId}>{title}</h2><p>{subtitle}</p></div>{children}</section></div>;
}

function NotificationsPage({items,unreadCount,onOpen,onMarkAllRead,onRefresh}) {
  return <div className="page-stack notification-center-page">
    <PageHeading eyebrow="CENTRAL DE AVISOS" title="Notificações" description="Acompanhe confirmações de doação, campanhas e atualizações da sua conta." action={<div className="notification-page-actions"><button className="btn btn-secondary btn-small" type="button" onClick={onRefresh}><RotateCcw size={15}/> Atualizar</button>{unreadCount>0&&<button className="btn btn-primary btn-small" type="button" onClick={onMarkAllRead}>Marcar todas como lidas</button>}</div>}/>
    <section className="panel notification-center-panel" aria-label="Lista de notificações">
      <div className="notification-center-summary"><span>{items.length} {items.length===1?"aviso":"avisos"}</span><span>{unreadCount} não {unreadCount===1?"lido":"lidos"}</span></div>
      {items.length ? <div className="notification-center-list">{items.map(item=><article key={item.id} className={`notification-center-card ${item.readAt?"is-read":"is-unread"}`}>
        <span className={`notification-item-icon ${item.type}`} aria-hidden="true">{item.type==="donation"?<Droplet size={19}/>:item.type==="campaign"?<HeartPulse size={19}/>:item.type==="appointment"?<CalendarDays size={19}/>:<Bell size={19}/>}</span>
        <div className="notification-center-copy"><div className="notification-center-title"><h3>{item.title}</h3>{!item.readAt&&<span className="notification-new-label">NOVA</span>}</div><p>{item.message}</p><time dateTime={item.createdAt}>{formatNotificationTime(item.createdAt)}</time></div>
        {!item.readAt&&<button className="btn btn-secondary btn-small notification-read-button" type="button" onClick={()=>onOpen(item)}>Marcar como lida</button>}
      </article>)}</div> : <div className="notification-empty notification-center-empty"><Bell size={28}/><b>Nenhuma notificação por enquanto</b><span>Quando uma doação for concluída, uma campanha for publicada ou houver uma atualização da sua conta, ela aparecerá nesta página.</span></div>}
    </section>
  </div>;
}

function HomePage({user,dashboard,count,nextLevel,progress,campaigns,centers,onNavigate,onAuth,onBook}) {
  return <div className="page-stack home-page">
    <section className="welcome-row">
      <div className="welcome-copy-wrap">
        <div className="eyebrow"><span className="eyebrow-dot"/> DOAÇÃO, CONEXÃO E CUIDADO</div>
        <h1>{user ? <>Olá, {user.name.split(" ")[0]} <span className="wave">✦</span></> : <>Sua solidariedade.<br/><span className="heading-muted">Em uma jornada mais simples.</span></>}</h1>
        <p className="welcome-copy">{user ? "Acompanhe sua carteira, seus registros e as próximas oportunidades de participação." : "O VIVA+ aproxima doadores e hemocentros para organizar a jornada de doação de sangue."}</p>
        <div className="hero-actions">
          {user ? <>
            <button className="btn btn-primary" onClick={onBook}><CalendarDays size={17}/> Agendar doação <ArrowRight size={16}/></button>
            <button className="btn btn-secondary" onClick={()=>onNavigate("carteira")}>Minha carteira <ChevronRight size={16}/></button>
          </> : <>
            <button className="btn btn-primary" onClick={()=>onNavigate("hemocentros")}><MapPin size={17}/> Encontrar hemocentro <ArrowRight size={16}/></button>
            <button className="btn btn-secondary" onClick={()=>onNavigate("campanhas")}>Ver campanhas <HeartPulse size={16}/></button>
          </>}
        </div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="hero-circle circle-one"/><div className="hero-circle circle-two"/>
        <div className="hero-heart"><HeartPulse size={76} strokeWidth={1.3}/></div>
        <div className="float-card float-top"><span className="float-icon"><Heart size={15} fill="currentColor"/></span><span><b>Um ato de amor</b><small>que faz a diferença</small></span></div>
        <div className="art-dot dot-one"/><div className="art-dot dot-two"/>
      </div>
    </section>

    {!user && <section className="home-steps" aria-labelledby="home-steps-title">
      <div className="home-section-heading">
        <span className="section-kicker">COMECE POR AQUI</span>
        <h2 id="home-steps-title">Três caminhos para participar</h2>
        <p>Conheça os recursos disponíveis e escolha por onde começar.</p>
      </div>
      <div className="home-step-grid">
        <article className="home-step-card">
          <span className="home-step-icon"><HandHeart size={21}/></span>
          <div><h3>Crie sua conta</h3><p>Acesse sua carteira digital e acompanhe os registros disponíveis no VIVA+.</p></div>
          <button className="text-link" onClick={onAuth}>Cadastrar <ArrowRight size={14}/></button>
        </article>
        <article className="home-step-card">
          <span className="home-step-icon"><MapPin size={21}/></span>
          <div><h3>Encontre uma unidade</h3><p>Consulte o diretório de hemocentros e localize informações de atendimento.</p></div>
          <button className="text-link" onClick={()=>onNavigate("hemocentros")}>Ver hemocentros <ArrowRight size={14}/></button>
        </article>
        <article className="home-step-card">
          <span className="home-step-icon"><HeartPulse size={21}/></span>
          <div><h3>Acompanhe campanhas</h3><p>Veja as campanhas cadastradas e as formas de mobilização disponíveis.</p></div>
          <button className="text-link" onClick={()=>onNavigate("campanhas")}>Ver campanhas <ArrowRight size={14}/></button>
        </article>
      </div>
    </section>}

    {user && <>
      <section className="stats-grid">
        <StatCard icon={Droplet} label="Doações validadas" value={count} detail="No seu histórico" color="green"/>
        <StatCard icon={Award} label="Seu nível" value={dashboard.level} detail="Reconhecimento cidadão" color="gold"/>
        <StatCard icon={CalendarDays} label="Agendamentos" value={dashboard.appointments.filter(a=>a.status==="confirmed").length} detail="Horários confirmados" color="blue"/>
        <StatCard icon={HeartPulse} label="Impacto potencial" value={`${count*4}`} detail="Estimativa informativa*" color="rose"/>
      </section>
      <section className="content-grid">
        <div className="panel progress-panel">
          <div className="panel-head"><div><span className="section-kicker">SUA JORNADA</span><h2>Seu próximo marco</h2></div><span className="icon-soft"><Award size={19}/></span></div>
          <div className="level-track"><div className="level-emblem" style={{"--level-color":nextLevel?.color || "#5b9fa6"}}><Award size={28}/></div><div className="level-main"><div className="level-labels"><b>{dashboard.level}</b><span>{nextLevel?`${count} de ${nextLevel.count} doações`:"Nível máximo alcançado"}</span></div><div className="progress-bar"><div style={{width:`${progress}%`}}/></div><small>{nextLevel?`Mais ${nextLevel.count-count} ${nextLevel.count-count===1?"doação":"doações"} validada(s) para o próximo selo`:"Parabéns pela sua jornada!"}</small></div></div>
          <div className="milestone-row">{levels.map(l=><div className={`milestone ${count>=l.count?"earned":""}`} key={l.name}><span style={{"--level-color":l.color}}><Award size={17}/></span><small>{l.name}</small></div>)}</div>
        </div>
        <div className="panel campaign-panel"><div className="panel-head"><div><span className="section-kicker">MOBILIZAÇÃO</span><h2>Campanhas</h2></div><button className="text-link" onClick={()=>onNavigate("campanhas")}>Ver todas <ArrowRight size={14}/></button></div>
          {campaigns.length ? campaigns.slice(0,2).map((c,i)=><CampaignMini key={c.id} campaign={c} index={i}/>) : <div className="campaign-feature"><div className="campaign-symbol"><HeartPulse size={24}/></div><div><span className="campaign-status"><i/> SEM CAMPANHAS ATIVAS</span><h3>Novas campanhas em breve</h3><p>As campanhas disponíveis para sua região aparecerão aqui.</p><button className="text-link" onClick={()=>onNavigate("hemocentros")}>Explorar unidades <ArrowRight size={14}/></button></div></div>}
        </div>
      </section>
    </>}

    <BloodStockPanel/>
    <section className="lower-grid home-lower-grid">
      <div className="panel centers-panel"><div className="panel-head"><div><span className="section-kicker">PERTO DE VOCÊ</span><h2>Encontre um hemocentro</h2></div><span className="icon-soft"><MapPin size={18}/></span></div>
        {centers.length ? <div className="center-list">{centers.slice(0,3).map(c=><div className="center-row" key={c.id}><span className="center-pin"><MapPin size={17}/></span><div className="center-info"><b>{c.name}</b><small>{c.region} · {c.city}/{c.state}</small></div><ChevronRight size={16}/></div>)}</div> : <p className="home-empty-copy">O diretório de unidades será exibido aqui quando houver cadastros disponíveis.</p>}
        <button className="btn btn-secondary btn-full" onClick={()=>onNavigate("hemocentros")}>Ver todas as unidades <ArrowRight size={15}/></button>
      </div>
      <div className="panel impact-panel"><div className="impact-glow"/><div className="impact-content"><span className="impact-label"><Sparkles size={14}/> NOSSO PROPÓSITO</span><h2>Pequenos gestos.<br/>Grandes transformações.</h2><p>O VIVA+ organiza recursos digitais para apoiar a jornada de quem deseja doar sangue.</p><button className="text-link" onClick={()=>onNavigate("impacto")}>Conhecer o projeto <ArrowRight size={14}/></button></div><div className="impact-art"><HeartPulse size={92} strokeWidth={1}/></div></div>
    </section>
  </div>;
}
function StatCard({icon:Icon,label,value,detail,color}) { return <div className="stat-card"><span className={`stat-icon ${color}`}><Icon size={20}/></span><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>; }
function CampaignMini({campaign,index}) { const scheduled = campaign.startDate && campaign.startDate > today; return <div className={`campaign-mini mini-${index}`}><span className="mini-icon"><Droplet size={19}/></span><div className="mini-copy"><span className="campaign-status"><i/> {scheduled?"CAMPANHA PROGRAMADA":"CAMPANHA ATIVA"}</span><h3>{campaign.title}</h3><p>{campaign.region} {campaign.bloodType?`· Tipo ${campaign.bloodType}`:""} </p></div><span className="mini-date">{fmtDate(campaign.endDate)}</span></div>; }

function PageHeading({eyebrow,title,description,action}) { return <div className="page-heading"><div><span className="section-kicker">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>; }
function WalletPage({user,dashboard,count,onAuth}) {
  if(!user) return <><PageHeading eyebrow="SUA IDENTIDADE DIGITAL" title="Minha carteira" description="Sua jornada de solidariedade, em um só lugar."/><LockedPanel onAuth={onAuth}/></>;
  const nextLevel = levels.find(level => count < level.count);
  const progress = nextLevel ? Math.min(100, (count / nextLevel.count) * 100) : 100;
  return <div className="page-stack">
    <PageHeading eyebrow="SUA IDENTIDADE DIGITAL" title="Minha carteira" description="Sua identidade digital reúne os dados essenciais da sua jornada de doação." />
    <div className="wallet-layout">
      <div className="wallet-card">
        <div className="wallet-card-bg"><div className="wallet-orb orb-a"/><div className="wallet-orb orb-b"/></div>
        <div className="wallet-top"><div className="wallet-brand"><Droplet fill="currentColor"/> VIVA<span>+</span></div><span className="wallet-status"><i/> CARTEIRA DIGITAL</span></div>
        <div className="wallet-title">CARTEIRA NACIONAL DO DOADOR</div>
        <div className="wallet-person"><div className="wallet-avatar">{user.name.charAt(0).toUpperCase()}</div><div><h2>{user.name}</h2><p>Membro VIVA+ · Desde {user.createdAt ? new Date(user.createdAt.replace(" ","T")+"Z").getFullYear() : "—"}</p></div></div>
        <div className="wallet-data">
          <div><small>TIPO SANGUÍNEO</small><strong>{user.bloodTypeVerified?user.bloodType:"—"}</strong><em>{user.bloodTypeVerified?"Validado por instituição":"Aguardando validação"}</em></div>
          <div><small>DOAÇÕES VALIDADAS</small><strong>{count.toString().padStart(2,"0")}</strong><em>Registros institucionais</em></div>
          <div><small>NÍVEL ATUAL</small><strong className="wallet-level">{dashboard.level}</strong><em>Selo cidadão solidário</em></div>
        </div>
        <div className="wallet-bottom"><div><small>ÚLTIMA DOAÇÃO</small><b>{fmtDate(user.lastDonationDate)}</b></div><div className="wallet-passcode-area"><DynamicWalletCode userId={user.id} role={user.role}/></div></div>
        <div className="wallet-watermark">VIVA+</div>
      </div>
      <div className="wallet-side">
        <div className="panel wallet-info"><span className="icon-soft"><ShieldCheck/></span><h3>Seu progresso de reconhecimento</h3>
          <p>Os selos evoluem somente com doações registradas e validadas por uma instituição parceira.</p>
          <div className="wallet-progress-head"><b>{nextLevel ? `Próximo nível: ${nextLevel.name}` : "Todos os níveis conquistados"}</b><span>{nextLevel ? `${count} de ${nextLevel.count}` : "10+ doações"}</span></div>
          <div className="progress-bar"><div style={{width:`${progress}%`}}/></div>
          <div className="info-divider"/>
          <div className="info-line"><Check/> Histórico de doações validadas</div><div className="info-line"><Award/> {benefits.filter(b=>isUnlocked(b,count)).length} de {benefits.length} propostas de benefício valem para o seu selo</div><div className="info-line"><Check/> Reconhecimento calculado automaticamente</div><div className="info-line"><LockKeyhole/> Dados exibidos conforme seu perfil de acesso</div>
        </div>
        <div className="panel wallet-info wallet-eligibility"><span className="icon-soft"><CalendarDays/></span><h3>Próxima data para consultar</h3><p>{user.lastDonationDate ? `Sua última doação registrada foi em ${fmtDate(user.lastDonationDate)}.` : "Ainda não há uma doação registrada na sua carteira."}</p><div className="eligibility-callout">Consulte o hemocentro para confirmar quando poderá doar novamente. O VIVA+ não determina aptidão clínica nem substitui a avaliação presencial.</div></div>
        <div className="notice-box"><b>Como usar seu código temporário</b><p>Mostre os 6 números ao funcionário do hemocentro. Ele digitará o código no painel institucional para localizar sua carteira. O código expira em 2 minutos e só pode ser usado uma vez. A equipe ainda deve conferir sua identidade com documento oficial. Isso não substitui triagem clínica nem sistemas oficiais da instituição.</p></div>
      </div>
    </div>
    <div className="panel table-panel"><div className="panel-head"><div><span className="section-kicker">SEU REGISTRO</span><h2>Histórico de doações</h2></div><span className="table-count">{dashboard.donations.length} registro(s)</span></div>{dashboard.donations.length?<div className="table-wrap"><table><thead><tr><th>Data</th><th>Instituição</th><th>Status</th></tr></thead><tbody>{dashboard.donations.map(d=><tr key={d.id}><td>{fmtDate(d.date)}</td><td>{d.hemocenter||"Instituição parceira"}</td><td><span className={`status-pill ${d.status}`}>{d.status==="validated"?"Validada":d.status==="pending"?"Pendente":"Recusada"}</span></td></tr>)}</tbody></table></div>:<div className="empty-table"><Droplet size={26}/><b>Seu histórico está começando</b><p>As doações aparecem aqui depois de validadas por um hemocentro parceiro.</p></div>}</div>
  </div>;
}
function DynamicWalletCode({userId, role}) {
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(120);
  const [error, setError] = useState("");
  useEffect(() => {
    if (role !== "donor") return;
    let active = true;
    let refreshTimer;
    const refresh = async () => {
      try {
        const data = await api("/me/wallet-code");
        if (!active) return;
        setCode(data.code);
        setSeconds(Number(data.expiresIn) || 120);
        setError("");
        refreshTimer = window.setTimeout(refresh, Math.max(30, (Number(data.expiresIn) || 120) - 5) * 1000);
      } catch (e) {
        if (active) { setCode(""); setError(e.message || "Código temporariamente indisponível"); refreshTimer = window.setTimeout(refresh, 8000); }
      }
    };
    refresh();
    const ticker = window.setInterval(() => setSeconds(value => value <= 1 ? 0 : value - 1), 1000);
    return () => { active = false; window.clearTimeout(refreshTimer); window.clearInterval(ticker); };
  }, [userId, role]);
  if (role !== "donor") return <div className="wallet-passcode-wrap"><small>CÓDIGO DO DOADOR</small><b className="wallet-passcode">— — — — — —</b><small>Disponível para perfil doador</small></div>;
  return <div className="wallet-passcode-wrap" aria-live="polite">
    <span className="wallet-passcode-label">CÓDIGO TEMPORÁRIO</span>
    <strong className="wallet-passcode">{code ? `${code.slice(0,3)} ${code.slice(3)}` : "— — —"}</strong>
    <small className={error ? "wallet-passcode-error" : "wallet-passcode-timer"}>{error || (code ? `Expira em ${seconds}s` : "Gerando código…")}</small>
  </div>;
}

function LockedPanel({onAuth}) { return <div className="panel locked-panel"><span className="locked-icon"><LockKeyhole size={28}/></span><h2>Entre para acessar sua carteira</h2><p>Crie uma conta gratuita para acompanhar seu histórico, seus selos e seus agendamentos.</p><button className="btn btn-primary" onClick={onAuth}>Entrar ou criar conta <ArrowRight size={16}/></button></div>; }

function CampaignPage({user,campaigns,onAuth,onBook}) {
  const [region,setRegion] = useState("Todas");
  const [bloodType,setBloodType] = useState("Todos");
  const todayKey = today;
  const visibleCampaigns = campaigns.filter(c => {
    const withinCampaignWindow = !c.endDate || c.endDate >= todayKey;
    return withinCampaignWindow && (region === "Todas" || c.region === region) && (bloodType === "Todos" || !c.bloodType || c.bloodType === bloodType);
  });
  const regions = [...new Set(campaigns.map(c=>c.region).filter(Boolean))];
  return <div className="page-stack">
    <PageHeading eyebrow="MOBILIZAÇÃO INTELIGENTE" title="Campanhas" description="Acompanhe ações de mobilização e descubra como participar." action={!user&&<button className="btn btn-primary" onClick={onAuth}>Entrar <ArrowRight size={15}/></button>}/>
    <div className="campaign-hero"><div><span className="impact-label"><HeartPulse size={14}/> SOLIDARIEDADE EM MOVIMENTO</span><h2>Uma corrente que<br/>não pode parar.</h2><p>Campanhas podem ser direcionadas por região, tipo sanguíneo e período, conforme a necessidade informada pelo hemocentro.</p></div><div className="campaign-hero-icon"><HeartPulse size={80}/><span><Droplet fill="currentColor"/></span></div></div>
    <div className="campaign-filter-panel panel"><div><span className="section-kicker">ENCONTRE UMA AÇÃO</span><h3>Filtrar campanhas</h3><p>As campanhas exibidas respeitam o período cadastrado pela instituição.</p></div><div className="campaign-filters"><label>Região<select value={region} onChange={e=>setRegion(e.target.value)}><option>Todas</option>{regions.map(r=><option key={r}>{r}</option>)}</select></label><label>Tipo sanguíneo<select value={bloodType} onChange={e=>setBloodType(e.target.value)}><option>Todos</option>{bloodTypes.map(t=><option key={t}>{t}</option>)}</select></label></div></div>
    {visibleCampaigns.length?<div className="campaign-grid">{visibleCampaigns.map((c,i)=>{const starts = c.startDate && c.startDate > todayKey; const status = starts ? "Programada" : "Ativa"; return <article className="campaign-card" key={c.id}><div className={`campaign-card-top cc-${i%3}`}><span><HeartPulse size={23}/></span><small><i/> {status.toUpperCase()}</small></div><div className="campaign-card-body"><span className="section-kicker">{c.region}{c.bloodType?` · Tipo ${c.bloodType}`:" · Todos os tipos"}</span><h3>{c.title}</h3><p>{c.description}</p><div className="campaign-meta"><span><CalendarDays size={15}/> {starts?`Início: ${fmtDate(c.startDate)}`:`Até ${fmtDate(c.endDate)}`}</span><span><MapPin size={15}/> {c.hemocenter||"Campanha da rede VIVA+"}</span></div><button className="btn btn-secondary btn-full" onClick={onBook}>Quero participar <ArrowRight size={15}/></button></div></article>})}</div>:<div className="panel empty-campaigns"><span><HeartPulse size={27}/></span><h2>{campaigns.length?"Nenhuma campanha corresponde aos filtros":"Nenhuma campanha disponível no momento"}</h2><p>{campaigns.length?"Altere a região ou o tipo sanguíneo para consultar outras campanhas ativas.":user?"Quando uma instituição cadastrar campanhas para o período atual, elas aparecerão aqui.":"Crie sua conta para acompanhar campanhas e agendar uma visita a um ponto de coleta."}</p>{campaigns.length>0&&<button className="btn btn-secondary" onClick={()=>{setRegion("Todas");setBloodType("Todos")}}>Limpar filtros</button>}{!user&&<button className="btn btn-primary" onClick={onAuth}>Criar conta gratuita</button>}</div>}
    <div className="notice-box"><b>Mobilização responsável</b><p>As campanhas são cadastradas por instituições e podem ser segmentadas por região e tipo sanguíneo. A existência de uma campanha não significa que qualquer pessoa esteja apta a doar: a avaliação é sempre presencial pela equipe de saúde.</p></div>
  </div>;
}
function CentersPage({centers,search,setSearch,notify}) { return <div className="page-stack"><PageHeading eyebrow="REDE DE COLETA" title="Encontre um hemocentro" description="Consulte unidades verificadas e confirme os detalhes diretamente com o serviço de hemoterapia."/><div className="searchbar"><MapPin size={19}/><input aria-label="Buscar hemocentros por unidade, região ou endereço" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por unidade, região ou endereço…"/>{search&&<button onClick={()=>setSearch("")}><X size={16}/></button>}</div><div className="center-grid">{centers.map((c,i)=><article className="panel center-card" key={c.id}><div className={`center-card-art art-${i%3}`}><div className="center-art-icon"><Building2 size={31}/></div><span className="demo-tag">{/\(teste\)|demonstração/i.test(c.name) ? "UNIDADE FICTÍCIA · DEMO" : "UNIDADE CADASTRADA"}</span><div className="art-line"/></div><div className="center-card-body"><span className="section-kicker">{c.region} · {c.city}/{c.state}</span><h3>{c.name}</h3><p><MapPin size={15}/>{c.address}</p><p><Clock3 size={15}/>{c.opening_hours || "Consulte a instituição"}</p><div className="center-card-footer"><span><i/>{/\(teste\)|demonstração/i.test(c.name) ? "Somente para apresentação" : "Fonte informada para conferência"}</span><div className="row-actions">{c.sourceUrl&&!/\(teste\)|demonstração/i.test(c.name)&&<a href={c.sourceUrl} target="_blank" rel="noreferrer">Ver fonte</a>}{c.bookingUrl&&!/\(teste\)|demonstração/i.test(c.name)&&<a href={c.bookingUrl} target="_blank" rel="noreferrer">Agendar na instituição</a>}<button className="icon-button" title="Copiar endereço" onClick={async()=>{try {await navigator.clipboard.writeText(c.address);notify("Endereço copiado.")}catch{notify("Não foi possível copiar o endereço.")}}}><Copy size={17}/></button></div></div></div></article>)}</div>{centers.length===0&&<div className="panel empty-campaigns"><h3>Nenhuma unidade verificada encontrada</h3><p>O diretório do VIVA+ ainda não tem unidades cadastradas. Enquanto isso, consulte diretamente o diretório oficial da Fundação Pró-Sangue para unidades em São Paulo.</p><p><a href="https://prosangue.sp.gov.br/hemocentros/Default.html" target="_blank" rel="noreferrer">Consultar hemocentros oficiais da Pró-Sangue</a> · <a href="https://prosangue.sp.gov.br/doacao/agende.html?Idioma=pt-BR" target="_blank" rel="noreferrer">Agendar diretamente na Pró-Sangue</a></p></div>}<div className="notice-box"><b>Antes de se deslocar</b><p>O VIVA+ exibe somente unidades cadastradas com uma fonte oficial informada. Confira a fonte, horários e condições diretamente com a instituição antes de se deslocar.</p></div></div>; }

function AppointmentsPage({user,appointments,onBook,onCancel,onAuth}) { return <div className="page-stack"><PageHeading eyebrow="ORGANIZE SUA VISITA" title="Agendamentos" description="Gerencie seus horários de doação registrados no VIVA+." action={<button className="btn btn-primary" onClick={onBook}><CalendarDays size={16}/> Novo agendamento</button>}/>{!user?<LockedPanel onAuth={onAuth}/>:appointments.length?<div className="appointment-list">{appointments.map(a=><div className="panel appointment-card" key={a.id}><div className="appointment-date"><span>{new Date(`${a.date}T12:00:00`).toLocaleDateString("pt-BR",{month:"short"}).replace(".","").toUpperCase()}</span><b>{new Date(`${a.date}T12:00:00`).getDate()}</b><small>{new Date(`${a.date}T12:00:00`).getFullYear()}</small></div><div className="appointment-details"><span className={`status-pill ${a.status}`}>{a.status==="pending"?"Pendente (registro anterior)":a.status==="confirmed"?"Confirmado no VIVA+":a.status==="cancelled"?"Cancelado":"Concluído"}</span><h3>{a.hemocenter}</h3><p><MapPin size={15}/>{a.region} · {a.address}</p><p><Clock3 size={15}/>{a.time}</p></div>{["pending","confirmed"].includes(a.status)&&<button className="btn btn-quiet-danger" onClick={()=>onCancel(a.id)}>Cancelar</button>}</div>)}</div>:<div className="panel empty-campaigns"><span><CalendarDays size={27}/></span><h2>Você ainda não tem agendamentos</h2><p>Escolha uma unidade, consulte os horários livres e confirme sua reserva imediatamente no VIVA+.</p><button className="btn btn-primary" onClick={onBook}>Agendar agora <ArrowRight size={15}/></button></div>}<div className="notice-box"><b>Como funciona a confirmação</b><p>Novos horários são confirmados imediatamente na agenda interna do VIVA+ e deixam de aparecer como disponíveis para outros doadores. A reserva não sincroniza com sistemas externos do hemocentro; confirme o funcionamento da unidade antes de se deslocar. A triagem presencial determina se a doação pode ser realizada.</p></div></div>; }

function BadgesPage({count,onNavigate}) { return <div className="page-stack"><PageHeading eyebrow="RECONHECIMENTO CIDADÃO" title="Meus selos" description="Cada selo desbloqueia propostas de benefício. O selo cresce com o histórico de doações validado por instituições."/><div className="badge-intro"><div className="badge-intro-symbol"><Award size={46}/></div><div><span className="section-kicker">SELO CIDADÃO SOLIDÁRIO</span><h2>Solidariedade que deixa marcas.</h2><p>O selo é um reconhecimento e não é pagamento: a doação continua voluntária. Os benefícios abaixo são propostas do projeto, que dependem de lei e de parceiros, e só valem para quem alcança o selo exigido.</p></div></div><div className="badge-grid">{levels.map(l=>{const list=benefitsFor(l.name);const earned=count>=l.count;return <div className={`panel badge-card ${earned?"badge-earned":""}`} key={l.name}><div className="badge-medal" style={{"--level-color":l.color}}><Award size={36}/>{earned&&<span><Check size={13}/></span>}</div><span className={`badge-state ${earned?"state-earned":""}`}>{earned?"CONQUISTADO":"PRÓXIMO MARCO"}</span><h3>{l.name}</h3><b>{l.count} {l.count===1?"doação validada":"doações validadas"}</b><p>{l.text}</p><ul className="badge-benefits">{list.map(b=><li key={b.id} className={earned?"on":""}>{earned?<Check size={11}/>:<Lock size={11}/>}<span>{b.title}</span></li>)}</ul><div className="badge-progress"><span style={{width:`${Math.min(100,count/l.count*100)}%`,background:l.color}}/></div><small>{Math.min(count,l.count)} de {l.count}</small></div>})}</div><button className="btn btn-secondary" onClick={()=>onNavigate("propostas")}><HandHeart size={16}/> Ver todas as propostas de benefício <ArrowRight size={15}/></button><div className="notice-box"><b>Como os selos funcionam</b><p>O nível é calculado automaticamente a partir das doações registradas e validadas por hemocentros parceiros. Autodeclarações não contam para a progressão. Os benefícios são cumulativos: quem é Diamante também alcança os de Bronze, Prata e Ouro.</p></div></div>; }

function ProposalsPage({user,count,dashboard,onAuth,onNavigate}) {
  const current = levelByName[dashboard.level];
  const next = levels.find(l => count < l.count) || null;
  const unlockedCount = user ? benefits.filter(b => isUnlocked(b, count)).length : 0;
  return <div className="page-stack proposals-page">
    <PageHeading eyebrow="RECONHECIMENTO CIDADÃO" title="Propostas e benefícios" description="Quanto mais doações validadas, maior o selo e mais propostas de benefício ele desbloqueia."/>
    <div className="proposal-intro"><span className="proposal-intro-icon"><HandHeart size={25}/></span><div><b>O selo é a chave dos benefícios</b><p>Os benefícios são vinculados ao selo da sua carteira. O transporte com 70% de desconto e o reforço do nível Gov.br só valem para o selo Diamante, com 10 ou mais doações validadas.</p></div><span className="proposal-status">PROPOSTAS CONCEITUAIS</span></div>
    <div className="tier-ladder" role="list" aria-label="Benefícios por selo">{levels.map(l=>{const list=benefitsFor(l.name);const earned=user&&count>=l.count;return <div role="listitem" className={`tier-step ${earned?"earned":""}`} key={l.name} style={{"--level-color":l.color}}><span className="tier-medal"><Award size={20}/></span><b>{l.name}</b><small>{l.count} {l.count===1?"doação":"doações"}</small><em>{list.length} {list.length===1?"proposta":"propostas"}</em></div>})}</div>
    {user ? <div className="proposal-me"><span className="tier-medal" style={{"--level-color":current?.color||"#9aa8a0"}}><Award size={22}/></span><div><b>Seu selo: {dashboard.level} · {count} {count===1?"doação validada":"doações validadas"}</b><p>{next?`Faltam ${next.count-count} ${next.count-count===1?"doação validada":"doações validadas"} para o selo ${next.name}, que desbloqueia ${benefitsFor(next.name).length} ${benefitsFor(next.name).length===1?"proposta":"propostas"}.`:"Você alcançou o selo máximo e todas as propostas valem para você."} {unlockedCount} de {benefits.length} propostas valem para o seu selo.</p></div><button className="text-link" onClick={()=>onNavigate("selos")}>Meus selos <ArrowRight size={14}/></button></div> : <div className="proposal-me"><span className="tier-medal"><Lock size={20}/></span><div><b>Entre para ver o que o seu selo desbloqueia</b><p>Crie sua conta e acompanhe quantas doações faltam para cada benefício.</p></div><button className="text-link" onClick={onAuth}>Criar conta <ArrowRight size={14}/></button></div>}
    <div className="proposal-grid">{benefits.map((item,index)=>{const Icon=iconMap[item.icon]||HandHeart;const tier=levelByName[item.tier];const open=user&&isUnlocked(item,count);const missing=Math.max(0,tier.count-count);return <article className={`panel proposal-card ${open?"proposal-open":"proposal-locked"}`} key={item.id}><div className="proposal-card-top"><span className="proposal-icon"><Icon size={21}/></span><span className="proposal-req" style={{"--level-color":tier.color}}><Award size={12}/> {item.tier} · {tier.count}+ {tier.count===1?"doação":"doações"}</span></div><span className="proposal-category">{item.category}</span><h2>{item.title}</h2><p>{item.description}</p><div className="proposal-detail"><b>Como poderia funcionar</b><span>{item.detail}</span></div><div className="proposal-foot"><span className={`proposal-state ${open?"ok":""}`}>{open?<><Check size={13}/> Vale para o seu selo</>:<><Lock size={13}/> {user?`Faltam ${missing} ${missing===1?"doação validada":"doações validadas"}`:`Exige selo ${item.tier}`}</>}</span><span className="proposal-tag">Em discussão · não é benefício garantido</span></div></article>})}</div>
    <div className="proposal-legal"><ShieldCheck size={19}/><p><b>Transparência:</b> estas são propostas do projeto, não benefícios concedidos hoje. A doação de sangue no Brasil é voluntária e não remunerada (Constituição Federal, art. 199, §4º); o selo é reconhecimento, não pagamento. A implementação depende de lei, orçamento e adesão das instituições. Hoje o VIVA+ não tem integração com o Gov.br nem com operadores de transporte, e a carteira não substitui documentos oficiais.</p></div>
  </div>;
}

function SettingsPage({user,preferences,setPreferences,onSubmit,passwordChangeForm,setPasswordChangeForm,onChangePassword,busy,onAuth}) { if(!user)return <div className="page-stack"><PageHeading eyebrow="CONTROLE DE DADOS" title="Preferências" description="Escolha como deseja receber comunicações do VIVA+."/><LockedPanel onAuth={onAuth}/></div>; return <div className="page-stack"><PageHeading eyebrow="CONTROLE DE DADOS" title="Preferências" description="Você controla suas comunicações e a segurança da conta."/><form className="panel settings-panel" onSubmit={onSubmit}><div className="settings-intro"><span className="icon-soft"><Bell/></span><div><h2>Notificações</h2><p>Suas escolhas podem ser alteradas a qualquer momento.</p></div></div><label className="toggle-row"><span><b>Campanhas para meu perfil</b><small>Receber avisos sobre campanhas de mobilização.</small></span><input type="checkbox" checked={preferences.notificationCampaigns} onChange={e=>setPreferences({...preferences,notificationCampaigns:e.target.checked})}/></label><label className="toggle-row"><span><b>Lembretes de elegibilidade</b><small>Receber lembretes para consultar quando pode doar novamente.</small></span><input type="checkbox" checked={preferences.notificationEligibility} onChange={e=>setPreferences({...preferences,notificationEligibility:e.target.checked})}/></label><button className="btn btn-primary">Salvar preferências <Check size={16}/></button><div className="notice-box"><b>Privacidade em primeiro lugar</b><p>Os avisos transacionais de segurança e registro de doação são enviados somente quando o provedor de e-mail está configurado e confirma a solicitação.</p></div></form><form className="panel settings-panel" onSubmit={onChangePassword}><div className="settings-intro"><span className="icon-soft"><LockKeyhole/></span><div><h2>Alterar senha</h2><p>Ao salvar, as outras sessões abertas serão encerradas e você precisará entrar novamente.</p></div></div><Field label="Senha atual"><input required type="password" autoComplete="current-password" value={passwordChangeForm.currentPassword} onChange={e=>setPasswordChangeForm({...passwordChangeForm,currentPassword:e.target.value})}/></Field><Field label="Nova senha (mínimo de 10 caracteres)"><input required minLength="10" type="password" autoComplete="new-password" value={passwordChangeForm.newPassword} onChange={e=>setPasswordChangeForm({...passwordChangeForm,newPassword:e.target.value})}/></Field><Field label="Confirme a nova senha"><input required minLength="10" type="password" autoComplete="new-password" value={passwordChangeForm.confirmPassword} onChange={e=>setPasswordChangeForm({...passwordChangeForm,confirmPassword:e.target.value})}/></Field><button className="btn btn-primary" disabled={busy}>{busy?"Salvando…":"Alterar senha e encerrar outras sessões"} <Check size={16}/></button></form></div>; }

function StaffWorkspace({user,onLogout,notify}) {
  const [code,setCode]=useState(""); const [donor,setDonor]=useState(null); const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const [donation,setDonation]=useState(false);
  async function lookup(e){e.preventDefault();setBusy(true);setError("");setDonor(null);setDonation(false);try{if(!/^\d{6}$/.test(code))throw new Error("Informe os seis dígitos do código temporário.");const data=await api("/institution/wallet-code/verify",{method:"POST",body:JSON.stringify({code})});setDonor(data.donor);setCode("");}catch(err){setError(err.message)}finally{setBusy(false)}}
  async function registerDonation(){if(!window.confirm("Confirma que a doação foi efetivamente realizada e registrada pela equipe responsável?"))return;setBusy(true);setError("");try{await api("/institution/donations",{method:"POST",body:JSON.stringify({userId:donor.id,date:today})});setDonation(true);notify("Doação registrada. O histórico e o selo do doador foram atualizados.")}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <div className="staff-shell"><header className="staff-header"><a className="brand" href="#atendimento"><span className="brand-mark"><Droplet size={23} fill="currentColor"/></span><span>VIVA<span className="brand-plus">+</span><small>ATENDIMENTO INSTITUCIONAL</small></span></a><div className="staff-identity"><span><b>{user.hemocenterName||"Unidade não identificada"}</b><small>{user.name} · Funcionário</small></span><button className="btn btn-secondary btn-small" onClick={onLogout}><LogOut size={15}/> Sair</button></div></header>
  <main className="staff-main" id="atendimento"><div className="staff-heading"><span className="section-kicker">ATENDIMENTO · VIVA+</span><h1>Registrar doação</h1><p>Informe o código temporário da carteira para localizar o doador e registrar a doação realizada.</p></div><form className="panel staff-lookup" onSubmit={lookup}><Field label="Código temporário de seis dígitos"><input autoFocus required type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000"/></Field><button className="btn btn-primary" disabled={busy||code.length!==6}>{busy?"Consultando…":"Consultar carteira"} <ArrowRight size={16}/></button></form>
  {error&&<div className="notice-box staff-error" role="alert">{error}</div>}{donor&&<section className="panel staff-donor-result"><div className="staff-result-title"><span className="icon-soft"><BadgeCheck/></span><div><span className="section-kicker">CARTEIRA LOCALIZADA</span><h2>{donor.name}</h2><small>Identificador interno #{donor.id}</small></div><span className="status-pill validated">Carteira ativa</span></div><p className="staff-privacy-note"><ShieldCheck size={16}/> Confira a identidade com documento oficial. A consulta do código não avalia aptidão clínica. Registre a doação somente após sua realização e confirmação pela equipe responsável.</p><div className="staff-actions"><button className="btn btn-primary" disabled={busy||donation} onClick={registerDonation}>{donation?<Check size={16}/>:<Droplet size={16}/>} {donation?"Doação registrada":"Registrar doação realizada"}</button></div><small className="staff-action-hint">{donation?"O histórico e o selo do doador foram atualizados automaticamente.":"Uma única confirmação registra a doação no histórico do doador e recalcula o selo."}</small></section>}</main><footer className="staff-footer">VIVA+ · Registro administrativo interno. Não substitui os sistemas oficiais de hemoterapia.</footer></div>;
}
function AdminCenterForm({onCreated}) {
  const [form,setForm] = useState({name:"",region:"",address:"",city:"",state:"SP",phone:"",openingHours:"",sourceUrl:"",bookingUrl:""});
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  async function submit(e) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      await api("/admin/hemocenters",{method:"POST",body:JSON.stringify(form)});
      setMessage("Unidade cadastrada. Revise a fonte oficial.");
      await onCreated?.();
      setForm({name:"",region:"",address:"",city:"",state:"SP",phone:"",openingHours:"",sourceUrl:"",bookingUrl:""});
    } catch(error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <form className="panel institution-form" onSubmit={submit}>
    <div className="panel-head"><div><span className="section-kicker">DIRETÓRIO VERIFICADO</span><h2>Cadastrar unidade real</h2></div><Building2/></div>
    <p className="form-description">Cadastre somente dados conferidos em uma fonte oficial da própria instituição ou do órgão público responsável.</p>
    <Field label="Nome da unidade"><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
    <Field label="Região"><input required value={form.region} onChange={e=>setForm({...form,region:e.target.value})} placeholder="Ex.: Centro"/></Field>
    <Field label="Endereço completo"><input required value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></Field>
    <div className="form-row"><Field label="Cidade"><input required value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></Field><Field label="UF"><input required maxLength="2" value={form.state} onChange={e=>setForm({...form,state:e.target.value.toUpperCase()})}/></Field></div>
    <div className="form-row"><Field label="Telefone"><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></Field><Field label="Horário informado"><input value={form.openingHours} onChange={e=>setForm({...form,openingHours:e.target.value})}/></Field></div>
    <Field label="Fonte oficial (URL HTTPS)"><input type="url" required placeholder="https://..." value={form.sourceUrl} onChange={e=>setForm({...form,sourceUrl:e.target.value})}/></Field>
    <Field label="Link oficial de agendamento (opcional)"><input type="url" placeholder="https://..." value={form.bookingUrl} onChange={e=>setForm({...form,bookingUrl:e.target.value})}/></Field>
    {message&&<p className="form-note" role="status">{message}</p>}
    <button className="btn btn-primary btn-full" disabled={busy}>{busy?"Cadastrando…":"Cadastrar unidade verificada"} <ArrowRight size={15}/></button>
  </form>;
}

function AdminDemoCenterForm({onCreated}){
  const [form,setForm]=useState({name:"",region:"",address:"",city:"",state:"SP"});const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  async function submit(e){e.preventDefault();setBusy(true);setMessage("");try{await api("/admin/demo-hemocenters",{method:"POST",body:JSON.stringify(form)});setMessage("Unidade fictícia criada e identificada como demonstração.");setForm({name:"",region:"",address:"",city:"",state:"SP"});await onCreated?.()}catch(e){setMessage(e.message)}finally{setBusy(false)}}
  return <form className="panel institution-form" onSubmit={submit}><div className="panel-head"><div><span className="section-kicker">AMBIENTE DE TESTES</span><h2>Criar unidade fictícia</h2></div><Building2/></div><p className="form-description">A unidade será marcada como “(teste)” e identificada como fictícia no diretório. Não representa parceria ou instituição real.</p><Field label="Nome de demonstração"><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field><Field label="Região"><input required value={form.region} onChange={e=>setForm({...form,region:e.target.value})}/></Field><Field label="Endereço fictício"><input required value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></Field><div className="form-row"><Field label="Cidade"><input required value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></Field><Field label="UF"><input required maxLength={2} value={form.state} onChange={e=>setForm({...form,state:e.target.value.toUpperCase()})}/></Field></div>{message&&<p role="status" className="form-note">{message}</p>}<button className="btn btn-secondary" disabled={busy}>Criar unidade de demonstração</button></form>
}

function BloodStockPanel() {
  const [stock,setStock]=useState(null);
  useEffect(()=>{let live=true;const load=()=>api("/blood-stock").then(d=>{if(live)setStock(d)}).catch(()=>{});load();const t=setInterval(load,60000);return()=>{live=false;clearInterval(t)}},[]);
  const hasLevels = bloodTypes.some(type => stock?.levels?.[type] && stock.levels[type] !== "Não informado");
  return <section className={`panel stock-panel ${hasLevels ? "has-stock-data" : "stock-compact"}`} aria-labelledby="stock-title">
    <div className="panel-head"><div><span className="section-kicker">INFORMAÇÃO DE ESTOQUE</span><h2 id="stock-title">Estoque de sangue</h2></div><Droplet/></div>
    {hasLevels ? <>
      <p>Situação cadastrada manualmente no VIVA+. Confirme sempre a informação diretamente com a instituição.</p>
      <div className="stock-grid">{bloodTypes.map(type=><div className="stock-type" key={type}><b>{type}</b><span>{stock?.levels?.[type] || "Não informado"}</span></div>)}</div>
      <small>{stock?.updatedAt?`Atualizado em ${new Date(stock.updatedAt).toLocaleString("pt-BR")}. Informação administrativa, não sincronizada automaticamente com a Pró-Sangue.`:"Não há atualização automática com hemocentros."}</small>
    </> : <p className="stock-unavailable">Ainda não há dados de estoque verificados ou sincronizados nesta versão. Consulte diretamente a fonte oficial.</p>}
    <a href="https://www.prosangue.sp.gov.br/" target="_blank" rel="noreferrer">Consultar informações oficiais da Pró-Sangue <ArrowRight size={14}/></a>
  </section>
}
function AdminManagement({centers,onRefresh,campaignForm,setCampaignForm,createCampaign,busy}){
  const [data,setData]=useState(null),[error,setError]=useState(""),[staffForm,setStaffForm]=useState({name:"",email:"",password:"",hemocenterId:""}),[saving,setSaving]=useState(false);
  const refresh=()=>api("/admin/management").then(setData).catch(e=>setError(e.message));useEffect(()=>{refresh()},[]);
  async function action(url,body){setError("");try{await api(url,{method:"PATCH",body:JSON.stringify(body)});await refresh();await onRefresh?.()}catch(e){setError(e.message)}}
  async function createStaff(e){e.preventDefault();setSaving(true);setError("");try{await api("/admin/staff",{method:"POST",body:JSON.stringify(staffForm)});setStaffForm({name:"",email:"",password:"",hemocenterId:""});await refresh()}catch(e){setError(e.message)}finally{setSaving(false)}}
  async function createNewCampaign(e){await createCampaign(e);await refresh()}
  async function editCampaign(c){const title=window.prompt("Título da campanha",c.title);if(title===null)return;const description=window.prompt("Descrição da campanha",c.description||"");if(description===null)return;const startDate=window.prompt("Data de início (AAAA-MM-DD)",c.startDate);if(startDate===null)return;const endDate=window.prompt("Data de término (AAAA-MM-DD)",c.endDate);if(endDate===null)return;await action(`/admin/campaigns/${c.id}`,{title,description,startDate,endDate})}
  return <div className="page-stack admin-management"><PageHeading eyebrow="AMBIENTE RESTRITO · ADMINISTRADOR" title="Gestão administrativa" description="Gerencie campanhas, funcionários, unidades e consulte os registros da plataforma."/>{error&&<p role="alert" className="notice-box">{error}</p>}<div className="stats-grid institution-stats admin-stats">{[["Doadores cadastrados",data?.totals?.donors??0],["Doações validadas",data?.totals?.donations??0],["Pendentes de validação",data?.totals?.pending??0],["Campanhas cadastradas",data?.totals?.campaigns??0]].map(([label,value])=><div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <section className="panel table-panel"><div className="panel-head"><div><span className="section-kicker">CAMPANHAS</span><h2>Gerenciamento de campanhas</h2></div></div><form className="admin-campaign-create" onSubmit={createNewCampaign}><Field label="Título"><input required value={campaignForm.title} onChange={e=>setCampaignForm({...campaignForm,title:e.target.value})}/></Field><Field label="Descrição"><input required value={campaignForm.description} onChange={e=>setCampaignForm({...campaignForm,description:e.target.value})}/></Field><div className="form-row"><Field label="Início"><input type="date" required value={campaignForm.startDate} onChange={e=>setCampaignForm({...campaignForm,startDate:e.target.value})}/></Field><Field label="Fim"><input type="date" required value={campaignForm.endDate} onChange={e=>setCampaignForm({...campaignForm,endDate:e.target.value})}/></Field></div><Field label="Região"><input required value={campaignForm.region} onChange={e=>setCampaignForm({...campaignForm,region:e.target.value})}/></Field><Field label="Unidade"><select value={campaignForm.hemocenterId} onChange={e=>setCampaignForm({...campaignForm,hemocenterId:e.target.value})}><option value="">Rede VIVA+</option>{centers.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></Field><button className="btn btn-primary" disabled={saving||busy}>Criar campanha</button></form>{data?.campaigns?.length?<div className="table-wrap"><table><thead><tr><th>Campanha</th><th>Período</th><th>Status</th><th>Ações</th></tr></thead><tbody>{data.campaigns.map(c=><tr key={c.id}><td>{c.title}</td><td>{fmtDate(c.startDate)} – {fmtDate(c.endDate)}</td><td>{c.status}</td><td className="row-actions"><button className="btn btn-secondary btn-small" onClick={()=>editCampaign(c)}>Editar</button><button className="btn btn-secondary btn-small" onClick={()=>action(`/admin/campaigns/${c.id}`,{status:c.status==="active"?"paused":"active"})}>{c.status==="active"?"Desativar":"Publicar"}</button></td></tr>)}</tbody></table></div>:<p className="empty-table">Nenhuma campanha cadastrada.</p>}</section>
    <div className="institution-forms"><form className="panel institution-form" onSubmit={createStaff}><div className="panel-head"><div><span className="section-kicker">ACESSO OPERACIONAL</span><h2>Criar funcionário</h2></div><Users/></div><Field label="Nome completo"><input required value={staffForm.name} onChange={e=>setStaffForm({...staffForm,name:e.target.value})}/></Field><Field label="E-mail"><input required type="email" value={staffForm.email} onChange={e=>setStaffForm({...staffForm,email:e.target.value})}/></Field><Field label="Senha inicial (mínimo 10 caracteres)"><input required type="password" minLength={10} value={staffForm.password} onChange={e=>setStaffForm({...staffForm,password:e.target.value})}/></Field><Field label="Unidade vinculada"><select required value={staffForm.hemocenterId} onChange={e=>setStaffForm({...staffForm,hemocenterId:e.target.value})}><option value="">Selecione</option>{centers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><button className="btn btn-primary" disabled={saving}>Criar conta</button></form><div className="admin-unit-forms"><AdminCenterForm onCreated={async()=>{await refresh();await onRefresh?.()}}/><AdminDemoCenterForm onCreated={async()=>{await refresh();await onRefresh?.()}}/></div></div>
    <section className="panel table-panel"><div className="panel-head"><div><span className="section-kicker">CONTAS DE DOADORES</span><h2>Gerenciamento de usuários</h2></div></div><div className="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Última doação registrada</th><th>Conta</th><th>Ação</th></tr></thead><tbody>{(data?.users||[]).map(d=><tr key={d.id}><td>{d.name}</td><td>{d.email}</td><td>{d.lastDonationDate?fmtDate(d.lastDonationDate):"—"}</td><td>{d.active?"Ativa":"Desativada"}</td><td className="row-actions"><button className="btn btn-secondary btn-small" onClick={()=>action(`/admin/users/${d.id}`,{active:!Boolean(d.active)})}>{d.active?"Desativar conta":"Reativar conta"}</button></td></tr>)}</tbody></table></div>{!data?.users?.length&&<p className="empty-table">Nenhum doador cadastrado.</p>}<p className="form-note">O painel apresenta apenas dados básicos de conta e atividade. Dados clínicos e informações desnecessárias não são exibidos.</p></section>
    <section className="panel table-panel"><div className="panel-head"><div><span className="section-kicker">EQUIPE</span><h2>Funcionários</h2></div></div><div className="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Unidade</th><th>Conta</th><th>Ação</th></tr></thead><tbody>{(data?.staff||[]).map(st=> <tr key={st.id}><td>{st.name}</td><td>{st.email}</td><td>{st.hemocenter||"Sem vínculo"}</td><td>{st.active?"Ativa":"Desativada"}</td><td className="row-actions"><button className="btn btn-secondary btn-small" onClick={()=>{const selected=window.prompt(`ID da nova unidade para ${st.name}:\n${centers.map(x=>`${x.id} — ${x.name}`).join("\n")}`,String(st.hemocenterId||""));if(selected!==null)action(`/admin/staff/${st.id}`,{active:Boolean(st.active),hemocenterId:Number(selected)})}}>Vincular unidade</button><button className="btn btn-secondary btn-small" onClick={()=>action(`/admin/staff/${st.id}`,{active:!Boolean(st.active),hemocenterId:st.hemocenterId})}>{st.active?"Desativar":"Ativar"}</button></td></tr>)}</tbody></table></div></section>
    <section className="panel table-panel"><div className="panel-head"><div><span className="section-kicker">INSTITUIÇÕES</span><h2>Unidades cadastradas</h2></div></div><div className="table-wrap"><table><thead><tr><th>Unidade</th><th>Local</th><th>Origem</th><th>Ação</th></tr></thead><tbody>{(data?.centers||[]).map(c=><tr key={c.id}><td>{c.name}</td><td>{c.city}/{c.state}</td><td>{/teste|demonstração/i.test(c.name)?"Fictícia · demonstração":"Cadastro institucional"}</td><td className="row-actions"><button className="btn btn-secondary btn-small" onClick={async()=>{const name=window.prompt("Nome da unidade",c.name);if(name===null)return;const region=window.prompt("Região",c.region);if(region===null)return;const address=window.prompt("Endereço",c.address||"");if(address===null)return;const city=window.prompt("Cidade",c.city);if(city===null)return;const state=window.prompt("UF",c.state);if(state===null)return;await action(`/admin/centers/${c.id}`,{name,region,address,city,state})}}>Editar</button><button className="btn btn-secondary btn-small" onClick={()=>action(`/admin/centers/${c.id}`,{active:!Boolean(c.active)})}>{c.active?"Desativar":"Ativar"}</button></td></tr>)}</tbody></table></div></section>
    {[["donations","Registros de doação",["Doador","Unidade","Data","Status"],r=>[r.donor,r.hemocenter||"—",r.date,r.status]],["audit","Histórico de alterações",["Responsável","Ação","Registro","Data"],r=>[r.actor||"Sistema",r.action,`${r.entityType} #${r.entityId||"—"}`,r.createdAt]]].map(([key,title,heads,values])=><section className="panel table-panel" key={key}><div className="panel-head"><h2>{title}</h2></div><div className="table-wrap"><table><thead><tr>{heads.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{(data?.[key]||[]).map(r=><tr key={r.id}>{values(r).map((v,i)=><td key={i}>{v}</td>)}</tr>)}</tbody></table></div></section>)}
    <p className="form-note">O painel exibe somente indicadores e registros disponíveis no banco VIVA+. O administrador não recebe dados médicos detalhados nem executa a validação operacional de carteiras.</p></div>
}

createRoot(document.getElementById("root")).render(<App/>);
