import React, { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { ASSET_TYPES, LOCATIONS } from '@/utils/constants';
import { EditableSelect } from '@/components/ui/EditableSelect';

const STATUS_OPTIONS = ['Disponible', 'Asignado', 'En Mantenimiento', 'Baja'];
const CONDITION_OPTIONS = ['Nuevo', 'Excelente', 'Bueno', 'Regular', 'Malo'];

// Función auxiliar para obtener siempre un valor string limpio de las constantes
const getInitialLocation = (loc) => {
  if (!loc) return '';
  return typeof loc === 'object' ? loc.value : loc;
};

export default function AssetForm({ assetToEdit, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    asset_tag: '',
    asset_type: 'Laptop/CPU',
    brand: '',
    model: '',
    serial_number: '',
    status: 'Asignado',
    condition: 'Excelente',
    assigned_to: '',
    location: getInitialLocation(LOCATIONS[0]),
    warranty_info: '',
    warranty_expiration: ''
  });

  useEffect(() => {
    if (assetToEdit) {
      setFormData({
        asset_tag: assetToEdit.asset_tag || assetToEdit.asset_code || '',
        asset_type: assetToEdit.asset_type || 'Laptop/CPU',
        brand: assetToEdit.brand || '',
        model: assetToEdit.model || '',
        serial_number: assetToEdit.serial_number || '',
        status: assetToEdit.status || 'Asignado',
        condition: assetToEdit.condition || 'Excelente',
        assigned_to: assetToEdit.assigned_to || '',
        location: getInitialLocation(assetToEdit.location || LOCATIONS[0]),
        warranty_info: assetToEdit.warranty_info || '',
        warranty_expiration: assetToEdit.warranty_expiration || ''
      });
    }
  }, [assetToEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        asset_tag: formData.asset_tag,
        asset_code: formData.asset_tag, // Compatibilidad con esquemas previos
        asset_type: formData.asset_type,
        brand: formData.brand,
        model: formData.model,
        serial_number: formData.serial_number,
        status: formData.status,
        condition: formData.condition,
        assigned_to: formData.assigned_to,
        location: formData.location,
        warranty_info: formData.warranty_info,
        warranty_expiration: formData.warranty_expiration || null
      };

      if (assetToEdit?.id) {
        const { error } = await supabase
          .from('assets')
          .update(payload)
          .eq('id', assetToEdit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('assets')
          .insert([payload]);
        if (error) throw error;
      }

      onSuccess();
    } catch (err) {
      alert('Error al guardar el equipo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* SECCIÓN 1: INFORMACIÓN PRINCIPAL */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Información Principal
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Etiqueta / Código */}
          <div>
            <label className="label">Etiqueta / Código *</label>
            <input
              type="text"
              name="asset_tag"
              required
              value={formData.asset_tag}
              onChange={handleChange}
              placeholder="Ej. TG00002"
              className="input-field"
            />
          </div>

          {/* Tipo de Activo */}
          <div>
            <label className="label">Tipo de Activo *</label>
            <EditableSelect
              name="asset_type"
              value={formData.asset_type}
              onChange={handleChange}
              options={ASSET_TYPES}
              placeholder="Ej. Impresora 3D"
            />
          </div>

          {/* Marca */}
          <div>
            <label className="label">Marca</label>
            <input
              type="text"
              name="brand"
              value={formData.brand}
              onChange={handleChange}
              placeholder="Ej. GRANDSTREAM"
              className="input-field"
            />
          </div>

          {/* Modelo */}
          <div>
            <label className="label">Modelo</label>
            <input
              type="text"
              name="model"
              value={formData.model}
              onChange={handleChange}
              placeholder="Ej. SX3001"
              className="input-field"
            />
          </div>

          {/* Nº Serie */}
          <div>
            <label className="label">Nº Serie (SN)</label>
            <input
              type="text"
              name="serial_number"
              value={formData.serial_number}
              onChange={handleChange}
              placeholder="Ej. SNXXXXXXXXX1"
              className="input-field"
            />
          </div>

          {/* Estado */}
          <div>
            <label className="label">Estado</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="input-field"
            >
              {STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: ASIGNACIÓN Y UBICACIÓN */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Asignación y Ubicación
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Asignado a */}
          <div>
            <label className="label">Asignado a</label>
            <input
              type="text"
              name="assigned_to"
              value={formData.assigned_to}
              onChange={handleChange}
              placeholder="Selecciona o escribe un nombre..."
              className="input-field"
            />
          </div>

          {/* Condición */}
          <div>
            <label className="label">Condición</label>
            <select
              name="condition"
              value={formData.condition}
              onChange={handleChange}
              className="input-field"
            >
              {CONDITION_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Ubicación / Oficina */}
          <div>
            <label className="label">Ubicación / Oficina</label>
            <EditableSelect
              name="location"
              value={formData.location}
              onChange={handleChange}
              options={LOCATIONS}
              placeholder="Ej. Sucursal Monterrey"
            />
          </div>
        </div>
      </div>

      {/* SECCIÓN 3: GARANTÍA */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Garantía
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Vencimiento de Garantía */}
          <div>
            <label className="label">Vencimiento de Garantía</label>
            <input
              type="date"
              name="warranty_expiration"
              value={formData.warranty_expiration}
              onChange={handleChange}
              className="input-field"
            />
          </div>

          {/* Info Adicional Garantía */}
          <div>
            <label className="label">Detalles de Garantía</label>
            <input
              type="text"
              name="warranty_info"
              value={formData.warranty_info}
              onChange={handleChange}
              placeholder="Ej. Proveedor / Cobertura ProSupport"
              className="input-field"
            />
          </div>
        </div>
      </div>

      {/* BOTONES DE ACCIÓN */}
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancelar
          </button>
        )}
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Guardando...' : assetToEdit ? 'Actualizar Equipo' : 'Guardar Equipo'}
        </button>
      </div>
    </form>
  );
}