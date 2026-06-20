import { useState } from 'react';
import axios from 'axios';
import MapPicker from './components/MapPicker';

export default function App() {
  const [position, setPosition] = useState({ lat: 6.2442, lng: -75.5812 });
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    direccion: '',
    referencia: '',
    metodoPago: 'efectivo'
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Para efectos de prueba, enviamos un producto dummy (ej. Hamburguesa)
      const payload = {
        tipoPedido: 'domicilio',
        estado: 'preparando',
        nombreCliente: formData.nombre,
        telefonoCliente: formData.telefono,
        direccionCliente: formData.direccion,
        referenciaCliente: formData.referencia,
        latitudCliente: position.lat,
        longitudCliente: position.lng,
        metodoPago: formData.metodoPago,
        costoDomicilio: 5000,
        productos: [
          {
            productoId: 1, 
            cantidad: 1, 
            precioUnitario: 15000,
            nombreProducto: 'Hamburguesa Especial'
          }
        ]
      };

      const res = await axios.post('http://localhost:4000/ordenes', payload);
      if (res.status === 201 || res.status === 200) {
        setSuccess(true);
      }
    } catch (err: any) {
      console.error(err);
      setError('Hubo un problema al crear tu orden. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg max-w-md w-full text-center border border-slate-200 dark:border-slate-700">
          <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">¡Orden Recibida!</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Tu domicilio está en camino. El domiciliario podrá ver la ubicación exacta de tu puerta.</p>
          <button 
            onClick={() => setSuccess(false)}
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-xl font-bold"
          >
            Nueva Orden
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-center">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Hacer un Pedido</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-6">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Ubicación Section */}
          <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
              <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded text-sm">1</span> 
              Fija tu ubicación
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Mueve el mapa para señalar la puerta exacta de tu casa. Esto ayudará a nuestro domiciliario.</p>
            <MapPicker position={position} onPositionChange={setPosition} />
          </section>

          {/* Datos Personales Section */}
          <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-sm">2</span> 
              Tus Datos
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre Completo</label>
                <input 
                  required
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleInputChange}
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Ej. Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Celular</label>
                <input 
                  required
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleInputChange}
                  type="tel" 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Ej. 300 123 4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Dirección Escrita</label>
                <input 
                  required
                  name="direccion"
                  value={formData.direccion}
                  onChange={handleInputChange}
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Ej. Calle 10 # 5-20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Referencia o Detalles <span className="text-slate-400 font-normal">(Opcional)</span></label>
                <input 
                  name="referencia"
                  value={formData.referencia}
                  onChange={handleInputChange}
                  type="text" 
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Ej. Casa de rejas azules, al lado de la tienda"
                />
              </div>
            </div>
          </section>

          {/* Pago Section */}
          <section className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="bg-green-100 text-green-600 px-2 py-1 rounded text-sm">3</span> 
              Método de Pago
            </h2>
            
            <div className="grid grid-cols-2 gap-3">
              <label className={`border rounded-xl p-4 cursor-pointer transition-all text-center flex flex-col items-center gap-2 ${formData.metodoPago === 'efectivo' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                <input type="radio" name="metodoPago" value="efectivo" checked={formData.metodoPago === 'efectivo'} onChange={handleInputChange} className="sr-only" />
                <span className="text-2xl">💵</span>
                <span className="font-medium">Efectivo</span>
              </label>

              <label className={`border rounded-xl p-4 cursor-pointer transition-all text-center flex flex-col items-center gap-2 ${formData.metodoPago === 'transferencia' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                <input type="radio" name="metodoPago" value="transferencia" checked={formData.metodoPago === 'transferencia'} onChange={handleInputChange} className="sr-only" />
                <span className="text-2xl">📱</span>
                <span className="font-medium">Transferencia</span>
              </label>
            </div>
          </section>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-center font-medium">
              {error}
            </div>
          )}

          {/* Submit */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#f5a524] hover:bg-[#e49413] text-black py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="animate-pulse">Procesando...</span>
            ) : (
              'Confirmar Pedido'
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
