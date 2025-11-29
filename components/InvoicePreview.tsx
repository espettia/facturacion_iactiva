import React from 'react';
import { InvoiceData } from '../types';

interface InvoicePreviewProps {
  data: InvoiceData;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({ data }) => {
  const calculateSubtotal = () => {
    return data.items.reduce((acc, item) => acc + (item.cantidad * item.precio), 0);
  };

  const igvRate = (data.empresa.igv ?? 18) / 100;
  const subtotal = calculateSubtotal();
  const igv = subtotal * igvRate;
  const total = subtotal + igv;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: data.empresa.moneda }).format(amount);
  };

  // Helper to render field or placeholder
  const RenderField = ({ value, label, className = "" }: { value: string | undefined, label: string, className?: string }) => {
    if (value && value.trim().length > 0) {
      return <span className={className}>{value}</span>;
    }
    return (
      <span className={`inline-block border border-red-300 bg-red-50 text-red-500 px-2 py-0.5 rounded text-xs italic ${className} print:hidden`}>
        [Falta: {label}]
      </span>
    );
  };

  return (
    <div className="bg-white shadow-xl rounded-lg overflow-hidden h-full flex flex-col md:w-[210mm] mx-auto print:shadow-none print:w-full transition-all duration-300">
      <div className="p-8 md:p-12 flex-1 overflow-auto print:overflow-visible relative">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-8 border-b pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <div className="w-10 h-10 bg-primary rounded-md flex items-center justify-center text-white font-bold text-xl print:text-black print:border-2 print:border-black">
                 {data.empresa.razon_social.charAt(0)}
               </div>
               <h1 className="text-2xl font-bold text-gray-800">{data.empresa.razon_social}</h1>
            </div>
            <p className="text-sm text-gray-600">{data.empresa.direccion}</p>
            <p className="text-sm text-gray-600 mt-1">RUC: {data.empresa.ruc}</p>
          </div>
          <div className="text-right border-2 border-dashed border-gray-300 p-4 rounded-lg bg-gray-50 print:bg-white print:border-gray-800">
            <h2 className="font-bold text-lg text-gray-700">FACTURA ELECTRÓNICA</h2>
            <p className="text-gray-600">RUC: {data.empresa.ruc}</p>
            <p className="font-mono text-lg font-bold text-primary print:text-black">{data.serie} - {data.numero}</p>
          </div>
        </div>

        {/* Client Info */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cliente</h3>
            <div className={`p-4 rounded-lg min-h-[100px] transition-colors ${!data.cliente.nombre ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
              <div className="font-bold text-gray-800 mb-1">
                <RenderField value={data.cliente.nombre} label="Nombre / Razón Social" />
              </div>
              <div className="text-sm text-gray-600 mb-1">
                <span className="font-medium">{data.cliente.tipo_doc === "6" ? "RUC" : "DNI"}: </span>
                <RenderField value={data.cliente.numero} label="Número Doc." />
              </div>
              <div className="text-sm text-gray-600">
                 {data.cliente.direccion ? data.cliente.direccion : <span className="text-gray-400 italic text-xs">Dirección (Opcional)</span>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Detalles</h3>
            <p className="text-sm text-gray-600"><span className="font-bold">Fecha:</span> {data.fecha_emision}</p>
            <p className="text-sm text-gray-600"><span className="font-bold">Moneda:</span> {data.empresa.moneda}</p>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-8">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-100">
                <th className="py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-12">Cant.</th>
                <th className="py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Descripción</th>
                <th className="py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right w-32">P. Unit</th>
                <th className="py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right w-32">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length > 0 ? (
                data.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-50 last:border-0 group hover:bg-gray-50 transition-colors">
                    <td className="py-3 text-sm text-gray-600">{item.cantidad}</td>
                    <td className="py-3 text-sm font-medium text-gray-800">{item.descripcion}</td>
                    <td className="py-3 text-sm text-gray-600 text-right">{formatCurrency(item.precio)}</td>
                    <td className="py-3 text-sm font-bold text-gray-800 text-right">{formatCurrency(item.precio * item.cantidad)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center bg-red-50 border border-dashed border-red-200 rounded-lg text-red-400 italic">
                    [Falta: Items o Productos] <br/>
                    <span className="text-xs text-red-300">Dile a la IA qué deseas facturar (ej. "1 Servicio de Consultoría por 100 soles")</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>IGV ({data.empresa.igv ?? 18}%)</span>
              <span>{formatCurrency(igv)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-gray-800 border-t pt-2 mt-2">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-12 text-center text-xs text-gray-400 border-t pt-4 print:mt-20">
          <p>Representación impresa de la Factura Electrónica.</p>
          <p>Generado automáticamente por IA.</p>
        </div>
      </div>
    </div>
  );
};