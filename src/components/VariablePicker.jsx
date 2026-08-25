import React, { useState } from 'react';
import { VARIABLE_TYPES } from '../utils/variableTypes';

const VariablePicker = ({ label, value, onChange }) => {
  const selectedType = value?.typeId ?? null;
  const varName = value?.name ?? '';
  const customUnit = value?.customUnit ?? '';

  const handleTypeSelect = (typeId) => {
    const type = VARIABLE_TYPES.find(t => t.id === typeId);
    onChange({ typeId, name: varName, unit: type?.unit ?? '', customUnit: '' });
  };

  const handleNameChange = (e) => {
    onChange({ ...value, name: e.target.value });
  };

  const handleUnitChange = (e) => {
    onChange({ ...value, customUnit: e.target.value, unit: e.target.value });
  };

  const selectedTypeDef = VARIABLE_TYPES.find(t => t.id === selectedType);

  return (
    <div>
      <div className="modal-step-label">{label}</div>

      {/* Type Grid */}
      <div className="var-picker-grid">
        {VARIABLE_TYPES.filter(t => t.id !== 'custom').map(type => (
          <button
            key={type.id}
            type="button"
            className={`var-type-tile${selectedType === type.id ? ' selected' : ''}`}
            onClick={() => handleTypeSelect(type.id)}
          >
            <span className="var-type-tile-icon">{type.icon}</span>
            <span className="var-type-tile-label">{type.label}</span>
          </button>
        ))}
      </div>

      {/* Custom Button Separated */}
      <button
        type="button"
        className={`var-type-tile custom-tile${selectedType === 'custom' ? ' selected' : ''}`}
        onClick={() => handleTypeSelect('custom')}
        style={{ width: '100%', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--bg-1)' }}
      >
        <span className="var-type-tile-icon">✍️</span>
        <span className="var-type-tile-label">Custom Variable</span>
      </button>

      {/* Name + Unit */}
      {selectedType && (
        <div className="var-config-row fade-in">
          <div>
            <label className="input-label">Variable Name</label>
            <input
              className="input"
              type="text"
              placeholder={selectedTypeDef?.placeholder ?? 'Give it a name'}
              value={varName}
              onChange={handleNameChange}
            />
          </div>
          <div>
            <label className="input-label">Unit / Measure</label>
            <input
              className="input"
              type="text"
              placeholder={selectedTypeDef?.unit || 'e.g. units'}
              value={value?.unit ?? ''}
              onChange={(e) => onChange({ ...value, unit: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VariablePicker;
