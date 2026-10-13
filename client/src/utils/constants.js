export const ASSET_TYPES = [
  { value: "laptop",     label: "Laptop"        },
  { value: "desktop",    label: "PC / Desktop"  },
  { value: "monitor",    label: "Monitor"       },
  { value: "printer",    label: "Impresora"     },
  { value: "server",     label: "Servidor"      },
  { value: "peripheral", label: "Periferico"    },
  { value: "other",      label: "Otro"          },
];
export const LOCATIONS = [
  { value: "main_office",    label: "Oficina Principal" },
  { value: "warehouse",      label: "Almacén" },
  { value: "ti",             label: "Sistemas / TI" },
  { value: "remote",         label: "Remoto" },
  { value: "ventas",         label: "Ventas" },
  { value: "rh",             label: "RH" },
  { value: "compras",        label: "Compras" },
  { value: "administracion", label: "Administración" },
];

export const ASSET_STATUS = [
  { value: "available",   label: "Disponible"        },
  { value: "assigned",    label: "Asignado"          },
  { value: "maintenance", label: "Mantenimiento"     },
  { value: "retired",     label: "Baja"              },
  { value: "stolen",      label: "Robado/Extraviado" },
];

export const TICKET_CATEGORIES = [
  { value: "netsuite",       label: "NetSuite"        },
  { value: "contpaqi",       label: "CONTPAQi"        },
  { value: "ecommerce",      label: "Ecommerce"       },
  { value: "redes_hardware", label: "Redes / Hardware"},
  { value: "rh",             label: "Recursos Humanos"},
  { value: "contabilidad",   label: "Contabilidad"    },
  { value: "marketing",      label: "Marketing"       },
  { value: "almacen",        label: "Almacen"         },
  { value: "otro",           label: "Otro"            },
];

export const TICKET_PRIORITIES = [
  { value: "low",      label: "Baja"    },
  { value: "medium",   label: "Media"   },
  { value: "high",     label: "Alta"    },
  { value: "critical", label: "Critica" },
];

export const TICKET_STATUS = [
  { value: "open",        label: "Abierto"     },
  { value: "in_progress", label: "En progreso" },
  { value: "waiting",     label: "En espera"   },
  { value: "resolved",    label: "Resuelto"    },
  { value: "closed",      label: "Cerrado"     },
];

export const LICENSE_TYPES = [
  { value: "perpetual",    label: "Perpetua"     },
  { value: "subscription", label: "Suscripcion"  },
  { value: "oem",          label: "OEM"          },
  { value: "freeware",     label: "Freeware"     },
  { value: "trial",        label: "Trial"        },
];

export const LICENSE_STATUS = [
  { value: "active",          label: "Activa"      },
  { value: "expired",         label: "Expirada"    },
  { value: "cancelled",       label: "Cancelada"   },
  { value: "pending_renewal", label: "Por renovar" },
];

export const DEVICE_TYPES = [
  { value: "workstation", label: "Estacion de trabajo" },
  { value: "server",      label: "Servidor"            },
  { value: "printer",     label: "Impresora"           },
  { value: "switch",      label: "Switch"              },
  { value: "router",      label: "Router"              },
  { value: "ap",          label: "Access Point"        },
  { value: "camera",      label: "Camara IP"           },
  { value: "other",       label: "Otro"                },
];

export const MAINTENANCE_TYPES = [
  { value: "preventive", label: "Preventivo" },
  { value: "corrective", label: "Correctivo" },
  { value: "network",    label: "Red"        },
  { value: "software",   label: "Software"   },
  { value: "other",      label: "Otro"       },
];

export const CARRIERS = ["Telcel", "AT&T", "Movistar", "Unefon", "Otro"];

export const DEPARTMENTS = [
  "TI", "Contabilidad", "RH", "Marketing",
  "Almacen", "Ecommerce", "Direccion", "Otro",
];