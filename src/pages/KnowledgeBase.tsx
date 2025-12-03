import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Upload, FileText, Trash2, Plus, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Document {
    id: string;
    name: string;
    size: string;
    uploadDate: string;
    status: 'processing' | 'ready' | 'error';
}

export const KnowledgeBase: React.FC = () => {
    const navigate = useNavigate();
    const [documents, setDocuments] = useState<Document[]>([
        { id: '1', name: 'Company_Policy_2024.pdf', size: '2.4 MB', uploadDate: '2024-03-15', status: 'ready' },
        { id: '2', name: 'Onboarding_Guide.docx', size: '1.1 MB', uploadDate: '2024-03-16', status: 'processing' },
    ]);

    const handleUpload = () => {
        // Mock upload
        const newDoc: Document = {
            id: Date.now().toString(),
            name: `New_Document_${documents.length + 1}.pdf`,
            size: '0.5 MB',
            uploadDate: new Date().toISOString().split('T')[0],
            status: 'processing',
        };
        setDocuments([newDoc, ...documents]);

        // Simulate processing
        setTimeout(() => {
            setDocuments(prev => prev.map(d => d.id === newDoc.id ? { ...d, status: 'ready' } : d));
        }, 3000);
    };

    const handleDelete = (id: string) => {
        setDocuments(documents.filter(d => d.id !== id));
    };

    return (
        <div className="min-h-screen bg-background text-white p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Button variant="ghost" onClick={() => navigate(-1)}>
                        <ArrowLeft size={20} />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Knowledge Base</h1>
                        <p className="text-gray-400">Manage documents for AI context (RAG)</p>
                    </div>
                </div>

                {/* Upload Area */}
                <div className="bg-surface border border-border border-dashed rounded-xl p-8 text-center mb-8 hover:bg-surface/50 transition-colors cursor-pointer" onClick={handleUpload}>
                    <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                        <Upload size={24} />
                    </div>
                    <h3 className="font-bold mb-2">Upload Documents</h3>
                    <p className="text-sm text-gray-400 mb-4">Drag & drop files here or click to browse</p>
                    <p className="text-xs text-gray-500">Supported formats: PDF, TXT, DOCX (Max 10MB)</p>
                </div>

                {/* Document List */}
                <div className="space-y-4">
                    <h2 className="font-bold text-lg mb-4">Uploaded Documents ({documents.length})</h2>

                    {documents.map((doc) => (
                        <div key={doc.id} className="bg-surface border border-border rounded-lg p-4 flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <h4 className="font-medium">{doc.name}</h4>
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <span>{doc.size}</span>
                                        <span>•</span>
                                        <span>{doc.uploadDate}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <span className={`text-xs px-2 py-1 rounded-full ${doc.status === 'ready' ? 'bg-green-500/20 text-green-400' :
                                        doc.status === 'processing' ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-red-500/20 text-red-400'
                                    }`}>
                                    {doc.status === 'processing' ? 'Processing...' :
                                        doc.status === 'ready' ? 'Ready' : 'Error'}
                                </span>

                                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-400" onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(doc.id);
                                }}>
                                    <Trash2 size={18} />
                                </Button>
                            </div>
                        </div>
                    ))}

                    {documents.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            No documents uploaded yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
