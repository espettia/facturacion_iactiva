import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Printer, Sparkles, AlertCircle, FileText, Settings, X, Save, History, CheckCircle } from 'lucide-react';
import { InvoicePreview } from './components/InvoicePreview';
import { HistoryModal } from './components/HistoryModal';
import { InvoiceData, INITIAL_INVOICE, ChatMessage, Company, DEFAULT_COMPANY } from './types';
import { sendMessageToAgent, resetSession } from './services/geminiService';

export default function App() {
  // --- State ---
  const [companyConfig, setCompanyConfig] = useState<Company>(() => {
    const saved = localStorage.getItem('companyConfig');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure IGV exists for backward compatibility
      return { ...DEFAULT_COMPANY, ...parsed };
    }
    return DEFAULT_COMPANY;
  });

  const [invoiceHistory, setInvoiceHistory] = useState<InvoiceData[]>(() => {
    const saved = localStorage.getItem('invoiceHistory');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [invoiceData, setInvoiceData] = useState<InvoiceData>(() => ({
    ...INITIAL_INVOICE,
    empresa: companyConfig,
    // Auto-increment number based on history if available
    numero: String((localStorage.getItem('lastInvoiceNumber') ? parseInt(localStorage.getItem('lastInvoiceNumber')!) + 1 : 1234)).padStart(8, '0')
  }));

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'model', text: '¡Hola! Soy tu asistente de facturación. ¿Qué factura deseas generar hoy?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState<Company>(companyConfig);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Sync company config changes to invoice data
  useEffect(() => {
    setInvoiceData(prev => ({
      ...prev,
      empresa: companyConfig
    }));
    localStorage.setItem('companyConfig', JSON.stringify(companyConfig));
  }, [companyConfig]);

  // Sync history to localStorage
  useEffect(() => {
    localStorage.setItem('invoiceHistory', JSON.stringify(invoiceHistory));
  }, [invoiceHistory]);

  // --- Handlers ---

  const handleSaveSettings = () => {
    setCompanyConfig(settingsForm);
    setShowSettings(false);
    // Reset chat session to adapt to new company persona
    resetSession();
    setMessages(prev => [
        ...prev, 
        { 
            id: Date.now().toString(), 
            role: 'model', 
            text: `Datos de la empresa actualizados a: ${settingsForm.razon_social}.` 
        }
    ]);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // Pass the current company config AND current invoice state to the agent
      const response = await sendMessageToAgent(inputText, companyConfig, invoiceData);
      
      if (response.dataUpdates) {
        setInvoiceData(prev => {
          const newData = { ...prev };
          
          if (response.dataUpdates?.cliente) {
            newData.cliente = { ...newData.cliente, ...response.dataUpdates.cliente };
          }
          
          if (response.dataUpdates?.items) {
             const newItems = response.dataUpdates.items || [];
             if (newItems.length > 0) {
                 newData.items = [...newData.items, ...newItems];
             }
          }
          return newData;
        });
      }

      const aiMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: response.text 
      };
      setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "Ocurrió un error inesperado.", isError: true }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Tu navegador no soporta reconocimiento de voz.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-PE';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSaveInvoice = () => {
    if (!isReady) return;

    // Save to history
    const newHistory = [invoiceData, ...invoiceHistory];
    setInvoiceHistory(newHistory);
    
    // Calculate next invoice number
    const currentNum = parseInt(invoiceData.numero);
    const nextNum = (currentNum + 1).toString().padStart(8, '0');
    localStorage.setItem('lastInvoiceNumber', currentNum.toString());

    // Notify user
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'model',
      text: `✅ Factura ${invoiceData.serie}-${invoiceData.numero} guardada correctamente en el historial.`
    }]);

    // Reset form for next invoice
    setInvoiceData({
      ...INITIAL_INVOICE,
      empresa: companyConfig,
      numero: nextNum,
      fecha_emision: new Date().toLocaleDateString('es-PE')
    });
  };

  const handleLoadFromHistory = (invoice: InvoiceData) => {
    setInvoiceData(invoice);
    // Optionally add a message saying we are viewing history
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'model',
      text: `👁️ Visualizando factura histórica: ${invoice.serie}-${invoice.numero}`
    }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Determine if invoice is ready to print
  const isReady = invoiceData.cliente.nombre && invoiceData.cliente.numero && invoiceData.items.length > 0;

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar / Chat Interface */}
      <div className="w-full md:w-1/3 bg-white border-r flex flex-col no-print h-full absolute md:relative z-10">
        <div className="p-4 border-b bg-white shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-gray-800">Agente Facturador</h1>
              <p className="text-xs text-gray-500">Impulsado por Gemini 2.5</p>
            </div>
          </div>
          <div className="flex gap-1">
            <button 
                onClick={() => setShowHistory(true)}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                title="Historial de Facturas"
            >
                <History className="w-5 h-5" />
            </button>
            <button 
                onClick={() => {
                    setSettingsForm(companyConfig);
                    setShowSettings(true);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                title="Configuración de Empresa"
            >
                <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-br-none'
                    : msg.isError 
                      ? 'bg-red-50 text-red-600 border border-red-100 rounded-bl-none'
                      : 'bg-white text-gray-700 border border-gray-100 rounded-bl-none'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-2xl rounded-bl-none border shadow-sm flex items-center gap-2">
                 <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-75"></div>
                 <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t">
          {/* Missing Fields Alerts */}
          {!isReady && (
             <div className="mb-3 p-2 bg-yellow-50 border border-yellow-100 rounded text-xs text-yellow-700 flex items-start gap-2">
               <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
               <div>
                 <span className="font-semibold">Falta información:</span>
                 <ul className="list-disc list-inside mt-1">
                   {!invoiceData.cliente.nombre && <li>Nombre del cliente</li>}
                   {!invoiceData.cliente.numero && <li>DNI o RUC del cliente</li>}
                   {invoiceData.items.length === 0 && <li>Items para facturar</li>}
                 </ul>
               </div>
             </div>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ej: Factura para Juan Perez DNI 12345678..."
                className="w-full border rounded-xl pl-4 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none h-12 min-h-[48px] max-h-32"
                rows={1}
              />
            </div>
            
            <button
              onClick={startListening}
              className={`p-3 rounded-xl transition-all ${
                isListening 
                  ? 'bg-red-100 text-red-600 animate-pulse ring-2 ring-red-400' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Hablar"
            >
              <Mic className="w-5 h-5" />
            </button>

            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputText.trim()}
              className="p-3 bg-primary text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content / Invoice Preview */}
      <div className="flex-1 p-4 md:p-8 bg-gray-200 overflow-y-auto relative flex flex-col items-center">
        {/* Toolbar */}
        <div className="w-full max-w-[210mm] mb-4 flex flex-col sm:flex-row justify-between items-center no-print gap-4">
            <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
                <FileText className="w-5 h-5"/> Vista Previa
            </h2>
            <div className="flex gap-2">
                <button 
                    onClick={handleSaveInvoice}
                    disabled={!isReady}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium shadow-sm transition-all ${
                        isReady 
                        ? 'bg-green-600 text-white hover:bg-green-700 hover:shadow-md' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    <CheckCircle className="w-4 h-4" />
                    Emitir & Guardar
                </button>
                <button 
                    onClick={handlePrint}
                    disabled={!isReady}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium shadow-sm transition-all ${
                        isReady 
                        ? 'bg-primary text-white hover:bg-blue-700 hover:shadow-md' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    <Printer className="w-4 h-4" />
                    Imprimir
                </button>
            </div>
        </div>

        <InvoicePreview data={invoiceData} />
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-500" />
                Configuración de Empresa
              </h3>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-gray-200 rounded-full text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Razón Social</label>
                <input 
                  type="text" 
                  value={settingsForm.razon_social}
                  onChange={e => setSettingsForm({...settingsForm, razon_social: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">RUC</label>
                <input 
                  type="text" 
                  value={settingsForm.ruc}
                  onChange={e => setSettingsForm({...settingsForm, ruc: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Dirección</label>
                <input 
                  type="text" 
                  value={settingsForm.direccion}
                  onChange={e => setSettingsForm({...settingsForm, direccion: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>
              <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Moneda</label>
                    <select 
                      value={settingsForm.moneda}
                      onChange={e => setSettingsForm({...settingsForm, moneda: e.target.value})}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                    >
                      <option value="PEN">Soles (PEN)</option>
                      <option value="USD">Dólares (USD)</option>
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">IGV (%)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="100"
                      value={settingsForm.igv}
                      onChange={e => setSettingsForm({...settingsForm, igv: Number(e.target.value)})}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                  </div>
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
              <button 
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveSettings}
                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-700 rounded-lg flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      <HistoryModal 
        isOpen={showHistory} 
        onClose={() => setShowHistory(false)} 
        history={invoiceHistory}
        onView={handleLoadFromHistory}
      />
    </div>
  );
}