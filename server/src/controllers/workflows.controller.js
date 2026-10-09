import { supabaseAdmin } from '../config/supabaseClient.js';

export const getWorkflows = async (req, res) => {
    const { data, error } = await supabaseAdmin.from('maintenance_workflows').select('*').order('title');
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
};

export const createWorkflow = async (req, res) => {
    const { data, error } = await supabaseAdmin.from('maintenance_workflows').insert([req.body]);
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
};

export const deleteWorkflow = async (req, res) => {
    const { error } = await supabaseAdmin.from('maintenance_workflows').delete().eq('id', req.params.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Eliminado correctamente' });
};