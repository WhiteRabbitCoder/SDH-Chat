import React from 'react';

const SearchResults = ({ results, onStartConversation }) => {
  if (results.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No se encontraron resultados.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-2 text-sm font-medium text-gray-500 border-b border-gray-800">
        Resultados de búsqueda ({results.length})
      </div>
      
      {results.map(user => (
        <div 
          key={user.id} 
          className="p-3 hover:bg-gray-800 transition-colors cursor-pointer flex items-center"
          onClick={() => onStartConversation(user)}
        >
          <div className="h-12 w-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
            <span className="material-symbols-outlined text-gray-400">person</span>
          </div>
          <div className="ml-3">
            <h4 className="font-medium">
              {user.nombre || user.nickname || 'Usuario sin nombre'}
              {user.departamento && (
                <span className="text-gray-400 text-sm ml-1">- {user.departamento}</span>
              )}
            </h4>
            <p className="text-sm text-gray-400">{user.correo}</p>
          </div>
          <div className="ml-auto">
            <button className="text-primary-500 hover:text-primary-400">
              <span className="material-symbols-outlined">chat</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SearchResults;