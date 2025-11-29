export interface Company {
  ruc: string;
  razon_social: string;
  moneda: string;
  direccion: string;
  igv: number; // Percentage, e.g., 18 for 18%
}

export interface Client {
  tipo_doc: string; // "1" for DNI, "6" for RUC
  numero: string;
  nombre: string;
  direccion?: string;
}

export interface InvoiceItem {
  descripcion: string;
  cantidad: number;
  precio: number;
}

export interface InvoiceData {
  empresa: Company;
  cliente: Client;
  items: InvoiceItem[];
  fecha_emision: string;
  serie: string;
  numero: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

// Fixed defaults as per requirement
export const DEFAULT_COMPANY: Company = {
  ruc: "20123456789",
  razon_social: "EMPRESA SAC",
  moneda: "PEN",
  direccion: "Av. Principal 123, Lima, Perú",
  igv: 18 // Default 18%
};

export const INITIAL_INVOICE: InvoiceData = {
  empresa: DEFAULT_COMPANY,
  cliente: {
    tipo_doc: "1",
    numero: "",
    nombre: "",
  },
  items: [],
  fecha_emision: new Date().toLocaleDateString('es-PE'),
  serie: "F001",
  numero: "00001234"
};