import React from 'react';
import { InvoiceData } from '../types';
import { Eye, X, Download } from 'lucide-react';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: InvoiceData[];
  onView: (invoice: InvoiceData) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, history, onView }) => {
  if (!isOpen) return null;

  const calculateTotal = (invoice: InvoiceData) => {
    const subtotal = invoice.items.reduce((acc, item) => acc + (item.cantidad * item.precio), 0);
    // Use the invoice's stored IGV or default to 18 if legacy data
    const igvRate = (invoice.empresa.igv ?? 18) / 100;
    return subtotal * (1 + igvRate);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800 text-lg">Historial de Facturas</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded-full text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-auto p-0">
          {history.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No hay facturas guardadas en el historial.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0 shadow-sm">
                <tr>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">N° Factura</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">RUC/DNI</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Total</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((invoice, index) => {
                  const total = calculateTotal(invoice);
                  return (
                    <tr key={index} className="hover:bg-blue-50/50 transition-colors">
                      <td className="p-4 text-sm font-medium text-gray-900">
                        {invoice.serie}-{invoice.numero}
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {invoice.fecha_emision}
                      </td>
                      <td className="p-4 text-sm text-gray-800">
                        {invoice.cliente.nombre}
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {invoice.cliente.numero}
                      </td>
                      <td className="p-4 text-sm font-bold text-gray-800 text-right">
                        {new Intl.NumberFormat('es-PE', { style: 'currency', currency: invoice.empresa.moneda }).format(total)}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => {
                            onView(invoice);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors shadow-sm"
                          title="Ver y Descargar"
                        >
                          <Eye className="w-4 h-4" />
                          Ver
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="p-4 border-t bg-gray-50 text-right text-xs text-gray-500">
          Total de facturas emitidas: {history.length}
        </div>
      </div>
    </div>
  );
};