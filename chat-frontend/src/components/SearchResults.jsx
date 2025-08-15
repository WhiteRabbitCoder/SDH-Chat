const SearchResultItem = ({ user, onStartConversation }) => (
  <div 
    className="p-3 hover:bg-gray-800 transition-colors cursor-pointer flex items-center gap-3"
    onClick={() => onStartConversation(user)}
  >
    <div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center">
      <span className="material-symbols-outlined">person_add</span>
    </div>
    <div>
      <h4 className="font-medium">{user.nickname}</h4>
      <p className="text-sm text-gray-400">{user.correo}</p>
    </div>
  </div>
);

const SearchResults = ({ results, onStartConversation }) => {
  if (results.length === 0) {
    return <div className="p-4 text-center text-gray-500">No se encontraron usuarios con ese correo.</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <h3 className="p-3 text-xs font-bold uppercase text-gray-400">Resultados de la búsqueda</h3>
      {results.map(user => (
        <SearchResultItem key={user.id} user={user} onStartConversation={onStartConversation} />
      ))}
    </div>
  );
};

export default SearchResults;