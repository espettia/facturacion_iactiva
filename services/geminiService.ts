import { GoogleGenAI, Type, FunctionDeclaration, Tool, Schema } from "@google/genai";
import { Client, InvoiceItem, Company, InvoiceData } from "../types";

// We define the structure we want the AI to extract
const updateInvoiceSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    cliente: {
      type: Type.OBJECT,
      properties: {
        nombre: { type: Type.STRING, description: "Nombre completo o razón social del cliente" },
        numero: { type: Type.STRING, description: "Número de documento (DNI o RUC)" },
        tipo_doc: { type: Type.STRING, description: "Tipo de documento. '1' para DNI (8 dígitos), '6' para RUC (11 dígitos)." },
        direccion: { type: Type.STRING, description: "Dirección del cliente (opcional)" },
      },
    },
    items: {
      type: Type.ARRAY,
      description: "Lista de productos o servicios a facturar",
      items: {
        type: Type.OBJECT,
        properties: {
          descripcion: { type: Type.STRING, description: "Descripción del producto o servicio" },
          cantidad: { type: Type.NUMBER, description: "Cantidad del item" },
          precio: { type: Type.NUMBER, description: "Precio unitario del item" },
        },
        required: ["descripcion", "cantidad", "precio"],
      },
    },
  },
};

const updateInvoiceTool: FunctionDeclaration = {
  name: "updateInvoice",
  description: "Actualiza los datos de la factura (cliente e items).",
  parameters: updateInvoiceSchema,
};

const tools: Tool[] = [{ functionDeclarations: [updateInvoiceTool] }];

// Dynamic System Instruction generator
const createSystemInstruction = (company: Company) => `
Eres un asistente experto en facturación electrónica para "${company.razon_social}".
Tu objetivo es ayudar al usuario a generar una factura válida completando TODOS los campos necesarios.

Datos de la empresa emisora (Tus datos):
- RUC: ${company.ruc}
- Razón Social: ${company.razon_social}
- Moneda: ${company.moneda}
- Impuesto (IGV): ${company.igv ?? 18}%

Reglas:
1. Extrae datos del CLIENTE (Nombre, DNI/RUC) y los ITEMS (Descripción, Cantidad, Precio).
2. Si el usuario menciona un servicio sin precio, intenta inferirlo o PREGUNTA.
3. SIEMPRE llama a la función 'updateInvoice' si detectas intención de facturar, incluso con datos parciales.
4. IMPORTANTE: Después de llamar a la herramienta, revisa la respuesta del sistema. Si indica que faltan datos (como nombre, dni o items), PIDE ESOS DATOS al usuario amablemente.
5. No inventes datos. Si falta el DNI, pídelo.
`;

let chatSession: any = null;
let currentCompanyJson: string = "";

export const resetSession = () => {
  chatSession = null;
  currentCompanyJson = "";
};

const initializeChat = (company: Company) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  chatSession = ai.chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: createSystemInstruction(company),
      tools: tools,
    },
  });
  currentCompanyJson = JSON.stringify(company);
};

export interface AgentResponse {
  text: string;
  dataUpdates?: {
    cliente?: Partial<Client>;
    items?: InvoiceItem[];
  };
}

export const sendMessageToAgent = async (
  message: string, 
  company: Company,
  currentInvoice: InvoiceData
): Promise<AgentResponse> => {
  // Initialize or Re-initialize if company settings changed
  if (!chatSession || JSON.stringify(company) !== currentCompanyJson) {
    initializeChat(company);
  }

  try {
    const result = await chatSession.sendMessage({ message });
    
    let responseText = "";
    let extractedData: any = {};
    let functionCallOccurred = false;

    const candidates = result.candidates;
    if (candidates && candidates[0]) {
      const parts = candidates[0].content.parts;
      
      for (const part of parts) {
        if (part.text) {
          responseText += part.text;
        }
        
        if (part.functionCall) {
            functionCallOccurred = true;
            const fc = part.functionCall;
            if (fc.name === 'updateInvoice') {
                const args = fc.args as any;
                extractedData = { ...extractedData, ...args };
                
                // Validate missing fields based on current state + updates
                const tempClient = { ...currentInvoice.cliente, ...(extractedData.cliente || {}) };
                const tempItems = [...currentInvoice.items, ...(extractedData.items || [])];
                
                const missing = [];
                if (!tempClient.nombre) missing.push("Nombre del Cliente");
                if (!tempClient.numero) missing.push("Número de Documento (DNI/RUC)");
                if (tempItems.length === 0) missing.push("Al menos un producto o servicio");

                let toolFeedback = "Datos procesados.";
                if (missing.length > 0) {
                   toolFeedback += ` ADVERTENCIA: Faltan los siguientes datos obligatorios para emitir la factura: ${missing.join(', ')}. Por favor pide estos datos al usuario.`;
                } else {
                   toolFeedback += " Todos los datos obligatorios están presentes. Puedes confirmar que la factura está lista.";
                }

                // Send tool response and await the model's follow-up
                // We use sendMessage to provide the functionResponse
                const toolResponse = await chatSession.sendMessage({
                    message: [{
                        functionResponse: {
                            id: fc.id,
                            name: fc.name,
                            response: { result: toolFeedback }
                        }
                    }]
                });

                // Get the text from the model's response to the tool output
                if (toolResponse.candidates && toolResponse.candidates[0]) {
                    const toolParts = toolResponse.candidates[0].content.parts;
                    const toolReplyText = toolParts.map((p: any) => p.text).join('');
                    if (toolReplyText) {
                        responseText = toolReplyText; // Replace initial thought with final response
                    }
                }
            }
        }
      }
    }

    // Fallback if no text was generated
    if (!responseText && Object.keys(extractedData).length > 0) {
        responseText = "He actualizado los datos. ¿Falta algo más?";
    }

    return {
      text: responseText || "Entendido.",
      dataUpdates: Object.keys(extractedData).length > 0 ? extractedData : undefined
    };

  } catch (error) {
    console.error("Error in Gemini communication:", error);
    return {
      text: "Lo siento, hubo un error de comunicación. Intenta de nuevo.",
    };
  }
};
