import React from 'react';
import { SendIcon } from 'lucide-react';
import Modal from '../../../shared/ui/Modal';
import { Project } from '../../../types';
import { ProjectBriefingData } from '../utils/projectCalendar';

interface ProjectBriefingModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project | null;
    briefingData: ProjectBriefingData;
}

export const ProjectBriefingModal: React.FC<ProjectBriefingModalProps> = ({
    isOpen,
    onClose,
    project,
    briefingData
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Bagikan Briefing Acara Pernikahan" size="2xl">
            {project && (
                <div className="space-y-4">
                    <textarea
                        value={briefingData.text}
                        readOnly
                        rows={15}
                        className="input-field w-full text-sm"
                    />
                    <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-2.5 sm:gap-3 pt-4 border-t border-slate-200">
                        <a
                            href={briefingData.whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="button-primary inline-flex items-center justify-center gap-2 text-xs sm:text-sm w-full sm:w-auto"
                        >
                            <SendIcon className="w-4 h-4" /> Bagikan ke WhatsApp
                        </a>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default ProjectBriefingModal;
