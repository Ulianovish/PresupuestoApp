import React from 'react';
export function Footer() {
  return <footer className="bg-white/10 backdrop-blur-md border-t border-white/20 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center md:justify-between items-center">
          <p className="text-sm text-gray-400">
            © 2023 Presupuesto 2025. Todos los derechos reservados.
          </p>
          <div className="hidden md:flex space-x-6">
            <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors duration-200">
              Términos
            </a>
            <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors duration-200">
              Privacidad
            </a>
            <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors duration-200">
              Contacto
            </a>
          </div>
        </div>
      </div>
    </footer>;
}