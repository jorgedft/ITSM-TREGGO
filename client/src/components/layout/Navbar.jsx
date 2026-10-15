import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Bell, BellRing, Search, Menu, LogOut, User, Settings, CheckCircle2,
  AlertTriangle, Ticket, Plane, X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../services/supabase";
import { isPushSupported, isSubscribed, subscribeToPush } from "../../lib/push";

const TYPE_ICONS = {
  ticket_nuevo: Ticket,
  ticket_asignado: Ticket,
  vacacion_nueva: Plane,
};

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "justo ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} d`;
}

export function Navbar({ onMenuToggle }) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);

  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const searchInputRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications(data || []);
  }, [user?.id]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  useEffect(() => {
    if (isPushSupported()) isSubscribed().then(setPushEnabled);
  }, []);

  // Notificaciones en vivo mientras la pestaña está abierta (además del push real).
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
          toast(payload.new.title, { icon: "🔔" });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Cerrar menús al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Atajo de teclado para enfocar la búsqueda al presionar "/"
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = async (n) => {
    if (!n.read) {
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    setShowNotifications(false);
    if (n.link) navigate(n.link);
  };

  const handleEnablePush = async () => {
    if (!user?.id) return;
    setEnablingPush(true);
    try {
      await subscribeToPush(user.id);
      setPushEnabled(true);
      toast.success("Notificaciones activadas en este dispositivo");
    } catch (err) {
      toast.error(err.message || "No se pudieron activar las notificaciones");
    } finally {
      setEnablingPush(false);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-2.5 flex items-center justify-between shrink-0 z-20 sticky top-0">

      {/* Lado Izquierdo: Toggle Móvil + Buscador */}
      <div className="flex items-center gap-3">
        {/* Botón menú responsive */}
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 lg:hidden focus:outline-none"
          title="Abrir Menú"
        >
          <Menu size={20} />
        </button>

        {/* Campo de búsqueda */}
        <div className="relative hidden sm:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar activo, ticket o usuario... (Presiona '/')"
            className="pl-9 pr-10 py-1.5 text-xs sm:text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent w-64 md:w-80 transition-all"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          ) : (
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden md:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 bg-gray-100 border border-gray-200 rounded">
              /
            </kbd>
          )}
        </div>
      </div>

      {/* Lado Derecho: Acciones y Perfil */}
      <div className="flex items-center gap-2 sm:gap-4 ml-auto">

        {/* Notificaciones Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="relative p-2 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
            title="Notificaciones"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Notificaciones</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-sky-50 text-sky-600 font-bold px-2 py-0.5 rounded-full">
                    {unreadCount} nuevas
                  </span>
                )}
              </div>

              {!pushEnabled && isPushSupported() && (
                <button
                  onClick={handleEnablePush}
                  disabled={enablingPush}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border-b border-gray-100 transition-colors disabled:opacity-50"
                >
                  <BellRing size={14} />
                  {enablingPush ? "Activando..." : "Activar notificaciones en este dispositivo"}
                </button>
              )}

              <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="p-4 text-center text-xs text-gray-400">Sin notificaciones por ahora.</p>
                ) : (
                  notifications.map((n) => {
                    const Icon = TYPE_ICONS[n.type] || (n.type?.includes("warning") ? AlertTriangle : CheckCircle2);
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`w-full text-left p-3 hover:bg-gray-50 transition-colors flex items-start gap-3 ${!n.read ? "bg-sky-50/40" : ""}`}
                      >
                        <Icon size={16} className="text-sky-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className={`text-xs ${!n.read ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>{n.title}</p>
                          {n.body && <p className="text-[11px] text-gray-500 truncate">{n.body}</p>}
                          <span className="text-[10px] text-gray-400">{timeAgo(n.created_at)}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-gray-200 hidden sm:block" />

        {/* Menú de Usuario */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 transition-colors focus:outline-none"
          >
            <div className="w-8 h-8 rounded-xl bg-sky-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {profile?.full_name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="hidden md:block text-left text-xs">
              <p className="font-semibold text-gray-900 leading-tight">
                {profile?.full_name || "Usuario"}
              </p>
              <p className="text-gray-400 text-[10px] capitalize">
                {profile?.role || "Técnico TI"}
              </p>
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50">
              <div className="px-4 py-2 border-b border-gray-100 md:hidden">
                <p className="text-xs font-bold text-gray-900">{profile?.full_name}</p>
                <p className="text-[10px] text-gray-400 capitalize">{profile?.role}</p>
              </div>

              <div className="p-1">
                <button
                  onClick={() => setShowProfileMenu(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-xl font-medium transition-colors"
                >
                  <User size={15} className="text-gray-400" /> Mi Perfil
                </button>
                <button
                  onClick={() => setShowProfileMenu(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded-xl font-medium transition-colors"
                >
                  <Settings size={15} className="text-gray-400" /> Ajustes
                </button>
              </div>

              <div className="border-t border-gray-100 p-1 mt-1">
                <button
                  onClick={signOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors"
                >
                  <LogOut size={15} /> Cerrar Sesión
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
