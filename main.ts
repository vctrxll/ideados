// main.ts - Archivo principal para la aplicación Twists

// Interfaces
interface User {
    id: number;
    name: string;
    username: string;
    avatar: string;
}

interface TwistData {
    id: number;
    content: string;
    author: User;
    timestamp: Date;
    parentId?: number; // Si es respuesta a otro twist
    childIds: number[]; // IDs de respuestas a este twist
    likes: number;
    retwists: number;
    replies: number;
}

/**
 * Clase principal de la aplicación Twists
 * Gestiona la creación y visualización de twists y sus hilos
 */
class TwistsApp {
    private twists: Map<number, TwistData> = new Map();
    private currentUser: User;

    private publishButton: HTMLButtonElement;
    private twistContentTextarea: HTMLTextAreaElement;
    private timelineElement: HTMLElement;

    private nextTwistId: number = 1;
    private activeReplyingTo: number | null = null;

    /**
     * Constructor - Inicializa la aplicación
     */
    constructor() {
        // Configurar usuario actual (simulado)
        this.currentUser = {
            id: 1,
            name: 'Usuario Actual',
            username: 'usuario_actual',
            avatar: '/api/placeholder/48/48'
        };

        // Obtener elementos del DOM
        const publishButtonElement = document.getElementById('publish-twist');
        const twistContentTextareaElement = document.getElementById('twist-content');
        const timelineElementTemp = document.getElementById('timeline');

        // Verificar que los elementos existen
        if (!publishButtonElement || !twistContentTextareaElement || !timelineElementTemp) {
            throw new Error('No se pudieron encontrar elementos esenciales del DOM');
        }

        this.publishButton = publishButtonElement as HTMLButtonElement;
        this.twistContentTextarea = twistContentTextareaElement as HTMLTextAreaElement;
        this.timelineElement = timelineElementTemp as HTMLElement;

        // Inicializar eventos
        this.inicializar();

        // Cargar datos de ejemplo
        this.cargarDatosEjemplo();
    }

    /**
     * Configuración inicial de eventos
     */
    private inicializar(): void {
        // Escuchar clic en botón publicar
        this.publishButton.addEventListener('click', () => this.publicarTwist());

        // Habilitar/deshabilitar botón publicar según contenido
        this.twistContentTextarea.addEventListener('input', () => {
            const contenido = this.twistContentTextarea.value.trim();
            this.publishButton.disabled = contenido.length === 0;
        });

        // Inicialmente deshabilitar el botón de publicar
        this.publishButton.disabled = true;

        // Delegación de eventos para el timeline (para manejar clics en botones de acción)
        this.timelineElement.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const action = target.closest('.action-btn');

            if (!action) return;

            // Encontrar el twist relacionado con la acción
            const twistElement = action.closest('.twist');
            if (!twistElement) return;

            const twistIdAttr = twistElement.getAttribute('data-id');
            if (!twistIdAttr) return;

            const twistId = parseInt(twistIdAttr);
            if (isNaN(twistId)) return;

            // Determinar qué acción se realizó
            if (action.classList.contains('reply-btn')) {
                this.mostrarFormularioRespuesta(twistId);
            } else if (action.classList.contains('like-btn')) {
                this.darLike(twistId);
            } else if (action.classList.contains('retwist-btn')) {
                this.hacerRetwist(twistId);
            }
        });
    }

    /**
     * Crea y publica un nuevo twist
     */
    private publicarTwist(parentId?: number): void {
        let contenido = '';

        if (parentId) {
            const replyContentElement = document.querySelector('.reply-content') as HTMLTextAreaElement | null;
            if (!replyContentElement) return;
            contenido = replyContentElement.value.trim();
        } else {
            contenido = this.twistContentTextarea.value.trim();
        }

        if (!contenido) return;

        // Crear nuevo objeto twist
        const nuevoTwist: TwistData = {
            id: this.nextTwistId++,
            content: contenido,
            author: this.currentUser,
            timestamp: new Date(),
            parentId: parentId,
            childIds: [],
            likes: 0,
            retwists: 0,
            replies: 0
        };

        // Si es una respuesta, actualizar el twist padre
        if (parentId) {
            const twistPadre = this.twists.get(parentId);
            if (twistPadre) {
                twistPadre.childIds.push(nuevoTwist.id);
                twistPadre.replies++;
                this.twists.set(parentId, twistPadre);

                // Actualizar contador en el DOM
                const replyCountElement = document.querySelector(`.twist[data-id="${parentId}"] .reply-btn .count`);
                if (replyCountElement) {
                    replyCountElement.textContent = twistPadre.replies.toString();
                }

                // Limpiar formulario de respuesta si existe
                const replyForm = document.querySelector('.reply-form');
                if (replyForm && replyForm.parentNode) {
                    replyForm.parentNode.removeChild(replyForm);
                }

                this.activeReplyingTo = null;
            }
        }

        // Guardar twist en la colección
        this.twists.set(nuevoTwist.id, nuevoTwist);

        // Limpiar campo de texto
        if (!parentId) {
            this.twistContentTextarea.value = '';
            this.publishButton.disabled = true;
        }

        // Añadir a la interfaz
        if (parentId) {
            // Si tiene padre, es parte de un hilo
            this.mostrarHiloCompleto(this.encontrarRaizHilo(parentId));
        } else {
            // Es un nuevo twist principal
            this.agregarTwistAlTimeline(nuevoTwist.id);
        }
    }

    /**
     * Busca la raíz del hilo (el primer twist en la conversación)
     */
    private encontrarRaizHilo(twistId: number): number {
        const twist = this.twists.get(twistId);
        if (!twist || !twist.parentId) return twistId;
        return this.encontrarRaizHilo(twist.parentId);
    }

    /**
     * Muestra un hilo completo en la interfaz
     */
    private mostrarHiloCompleto(raizId: number): void {
        // Eliminar el hilo anterior si existe
        const hiloExistente = document.querySelector(`.twist[data-id="${raizId}"]`);
        if (hiloExistente && hiloExistente.parentNode) {
            const padre = hiloExistente.parentNode;
            // Conservar la posición en el timeline
            const index = Array.from(padre.children).indexOf(hiloExistente);

            // Eliminar todos los elementos del hilo anterior
            let next: Element | null = hiloExistente;
            while (next && (
                next.classList.contains('twist') ||
                next.classList.contains('reply-form')
            )) {
                const toRemove = next;
                next = next.nextElementSibling;
                padre.removeChild(toRemove);
            }

            // Reconstruir el hilo
            const fragmento = document.createDocumentFragment();
            this.construirHiloDOM(raizId, fragmento, true);

            // Insertar en la posición original
            if (index >= 0 && index < padre.children.length) {
                padre.insertBefore(fragmento, padre.children[index]);
            } else {
                padre.appendChild(fragmento);
            }
        } else {
            // Si no existe, agregar al inicio del timeline
            const twist = this.twists.get(raizId);
            if (twist) {
                this.agregarTwistAlTimeline(raizId);
            }
        }
    }

    /**
     * Construye el DOM para un hilo de twists recursivamente
     */
    private construirHiloDOM(twistId: number, container: DocumentFragment | HTMLElement, esRaiz: boolean = false): void {
        const twist = this.twists.get(twistId);
        if (!twist) return;

        // Usar la plantilla según si es raíz o parte del hilo
        const templateId = esRaiz ? 'twist-template' : 'thread-twist-template';
        const template = document.getElementById(templateId) as HTMLTemplateElement | null;
        if (!template) return;

        // Clonar la plantilla
        const twistElement = template.content.cloneNode(true) as DocumentFragment;
        const twistArticle = twistElement.querySelector('.twist') as HTMLElement | null;
        if (!twistArticle) return;

        // Establecer ID de referencia
        twistArticle.setAttribute('data-id', twist.id.toString());

        // Rellenar datos del twist
        const authorElement = twistArticle.querySelector('.twist-author');
        const usernameElement = twistArticle.querySelector('.twist-username');
        const timeElement = twistArticle.querySelector('.twist-time');
        const textElement = twistArticle.querySelector('.twist-text');
        const likeCountElement = twistArticle.querySelector('.like-btn .count');
        const retwistCountElement = twistArticle.querySelector('.retwist-btn .count');
        const replyCountElement = twistArticle.querySelector('.reply-btn .count');
        const avatarImage = twistArticle.querySelector('.twist-avatar img') as HTMLImageElement | null;

        if (authorElement) authorElement.textContent = twist.author.name;
        if (usernameElement) usernameElement.textContent = '@' + twist.author.username;
        if (timeElement) timeElement.textContent = this.formatearTiempo(twist.timestamp);
        if (textElement) textElement.textContent = twist.content;
        if (likeCountElement) likeCountElement.textContent = twist.likes.toString();
        if (retwistCountElement) retwistCountElement.textContent = twist.retwists.toString();
        if (replyCountElement) replyCountElement.textContent = twist.replies.toString();
        if (avatarImage) avatarImage.src = twist.author.avatar;

        // Añadir al contenedor
        container.appendChild(twistElement);

        // Si tiene hijos, construir recursivamente
        if (twist.childIds.length > 0) {
            twist.childIds.forEach(childId => {
                this.construirHiloDOM(childId, container);
            });
        }
    }

    /**
     * Agrega un twist al inicio del timeline
     */
    private agregarTwistAlTimeline(twistId: number): void {
        const fragmento = document.createDocumentFragment();
        this.construirHiloDOM(twistId, fragmento, true);

        // Agregar al inicio del timeline
        if (this.timelineElement.firstChild) {
            this.timelineElement.insertBefore(fragmento, this.timelineElement.firstChild);
        } else {
            this.timelineElement.appendChild(fragmento);
        }
    }

    /**
     * Muestra el formulario para responder a un twist
     */
    private mostrarFormularioRespuesta(twistId: number): void {
        // Si ya hay un formulario de respuesta activo para este twist, no hacer nada
        if (this.activeReplyingTo === twistId) return;

        // Eliminar formulario de respuesta anterior si existe
        const replyFormExistente = document.querySelector('.reply-form');
        if (replyFormExistente && replyFormExistente.parentNode) {
            replyFormExistente.parentNode.removeChild(replyFormExistente);
        }

        // Obtener el twist al que se responde
        const twist = this.twists.get(twistId);
        if (!twist) return;

        // Obtener el elemento del twist en el DOM
        const twistElement = document.querySelector(`.twist[data-id="${twistId}"]`);
        if (!twistElement) return;

        // Obtener la plantilla del formulario de respuesta
        const template = document.getElementById('reply-form-template') as HTMLTemplateElement | null;
        if (!template) return;

        // Clonar la plantilla
        const replyFormFragment = template.content.cloneNode(true) as DocumentFragment;
        const replyFormElement = replyFormFragment.firstElementChild;
        if (!replyFormElement) return;

        // Configurar eventos
        const replyBtn = replyFormElement.querySelector('.reply-btn') as HTMLButtonElement | null;
        const replyTextarea = replyFormElement.querySelector('.reply-content') as HTMLTextAreaElement | null;

        if (replyBtn && replyTextarea) {
            replyBtn.addEventListener('click', () => {
                this.publicarTwist(twistId);
            });

            replyTextarea.addEventListener('input', () => {
                if (replyBtn) {
                    replyBtn.disabled = replyTextarea.value.trim().length === 0;
                }
            });

            // Deshabilitar el botón inicialmente
            replyBtn.disabled = true;
        }

        // Insertar después del twist
        if (replyFormElement) {
            twistElement.insertAdjacentElement('afterend', replyFormElement as Element);
        }

        // Enfocar el textarea
        if (replyTextarea) {
            setTimeout(() => {
                replyTextarea.focus();
            }, 0);
        }

        this.activeReplyingTo = twistId;
    }

    /**
     * Dar like a un twist
     */
    private darLike(twistId: number): void {
        const twist = this.twists.get(twistId);
        if (!twist) return;

        twist.likes++;
        this.twists.set(twistId, twist);

        // Actualizar contador en el DOM
        const likeCountElement = document.querySelector(`.twist[data-id="${twistId}"] .like-btn .count`);
        if (likeCountElement) {
            likeCountElement.textContent = twist.likes.toString();
        }
    }

    /**
     * Hacer retwist de un twist
     */
    private hacerRetwist(twistId: number): void {
        const twist = this.twists.get(twistId);
        if (!twist) return;

        twist.retwists++;
        this.twists.set(twistId, twist);

        // Actualizar contador en el DOM
        const retwistCountElement = document.querySelector(`.twist[data-id="${twistId}"] .retwist-btn .count`);
        if (retwistCountElement) {
            retwistCountElement.textContent = twist.retwists.toString();
        }
    }

    /**
     * Formatea el tiempo relativo (ahora, hace 5m, etc.)
     */
    private formatearTiempo(fecha: Date): string {
        const ahora = new Date();
        const diferenciaMs = ahora.getTime() - fecha.getTime();
        const diferenciaSegundos = Math.floor(diferenciaMs / 1000);

        if (diferenciaSegundos < 60) {
            return 'ahora';
        } else if (diferenciaSegundos < 3600) {
            const minutos = Math.floor(diferenciaSegundos / 60);
            return `hace ${minutos}m`;
        } else if (diferenciaSegundos < 86400) {
            const horas = Math.floor(diferenciaSegundos / 3600);
            return `hace ${horas}h`;
        } else {
            const dias = Math.floor(diferenciaSegundos / 86400);
            return `hace ${dias}d`;
        }
    }

    /**
     * Carga datos de ejemplo para mostrar al iniciar
     */
    private cargarDatosEjemplo(): void {
        // Usuario de ejemplo
        const usuarioEjemplo: User = {
            id: 2,
            name: 'Dev JavaScript',
            username: 'devjs',
            avatar: '/api/placeholder/48/48'
        };

        // Twist principal
        const twistPrincipal: TwistData = {
            id: this.nextTwistId++,
            content: '¡Acabo de descubrir TypeScript y me encanta! La tipificación estática hace que mi código sea mucho más robusto 🚀',
            author: usuarioEjemplo,
            timestamp: new Date(Date.now() - 1800000), // 30 minutos atrás
            childIds: [],
            likes: 15,
            retwists: 7,
            replies: 0
        };

        this.twists.set(twistPrincipal.id, twistPrincipal);

        // Respuesta al twist principal
        const respuesta1: TwistData = {
            id: this.nextTwistId++,
            content: '¡Totalmente de acuerdo! TypeScript ha cambiado mi forma de programar en JavaScript. Los tipos son vida.',
            author: this.currentUser,
            timestamp: new Date(Date.now() - 900000), // 15 minutos atrás
            parentId: twistPrincipal.id,
            childIds: [],
            likes: 5,
            retwists: 1,
            replies: 0
        };

        this.twists.set(respuesta1.id, respuesta1);
        twistPrincipal.childIds.push(respuesta1.id);
        twistPrincipal.replies++;

        // Respuesta a la respuesta
        const respuesta2: TwistData = {
            id: this.nextTwistId++,
            content: '¿Qué características de TypeScript les parecen más útiles? Yo no puedo vivir sin las interfaces y los genéricos.',
            author: usuarioEjemplo,
            timestamp: new Date(Date.now() - 600000), // 10 minutos atrás
            parentId: respuesta1.id,
            childIds: [],
            likes: 3,
            retwists: 0,
            replies: 0
        };

        this.twists.set(respuesta2.id, respuesta2);
        respuesta1.childIds.push(respuesta2.id);
        respuesta1.replies++;

        // Añadir a la interfaz
        this.mostrarHiloCompleto(twistPrincipal.id);

        // Otro twist independiente
        const otroTwist: TwistData = {
            id: this.nextTwistId++,
            content: '¿Alguien está usando React con TypeScript? Necesito ayuda con la tipificación de props en componentes funcionales.',
            author: {
                id: 3,
                name: 'TypeScript Fan',
                username: 'ts_rocks',
                avatar: '/api/placeholder/48/48'
            },
            timestamp: new Date(Date.now() - 3600000), // 1 hora atrás
            childIds: [],
            likes: 8,
            retwists: 2,
            replies: 0
        };

        this.twists.set(otroTwist.id, otroTwist);
        this.agregarTwistAlTimeline(otroTwist.id);
    }
}

// Iniciar la aplicación cuando se cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
    new TwistsApp();
});