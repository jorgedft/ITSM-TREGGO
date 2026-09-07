import React, { useState, useRef, useEffect } from "react";
import { Bell, Search, Menu, LogOut, User, Settings, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export function Navbar({ onMenuToggle }) {
  const { profile, signOut } = useAuth();
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const searchInputRef = useRef(null);

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

  // Simulación de notificaciones activas
  const notifications = [
    { id: 1, title: "Licencia M365 próxima a vencer", type: "warning", time: "Hace 10 min" },
    { id: 2, title: "Nuevo ticket de soporte creado", type: "info", time: "Hace 1 hora" },
  ];

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
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Notificaciones</h3>
                <span className="text-[10px] bg-sky-50 text-sky-600 font-bold px-2 py-0.5 rounded-full">
                  {notifications.length} nuevas
                </span>
              </div>
              <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="p-3 hover:bg-gray-50 transition-colors flex items-start gap-3">
                    {n.type === "warning" ? (
                      <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 size={16} className="text-sky-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-xs font-medium text-gray-800">{n.title}</p>
                      <span className="text-[10px] text-gray-400">{n.time}</span>
                    </div>
                  </div>
                ))}
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