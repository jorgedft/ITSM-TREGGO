export function ComingSoon({ title, description, icon: Icon }) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-24 bg-white border border-gray-100 rounded-2xl shadow-sm">
            {Icon && (
                <div className="p-4 rounded-2xl bg-gray-50 text-gray-400 mb-4">
                    <Icon size={32} />
                </div>
            )}
            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">
                {description || 'Este módulo está en construcción. Próximamente estará disponible.'}
            </p>
        </div>
    );
}
