import type { Idioma } from './index';

export interface BloqueAviso { titulo: string; parrafos: string[] }

/**
 * Aviso de privacidad integral. Cumple los requisitos de información de la
 * LFPDPPP (México, arts. 15-16), la LGPD (Brasil, art. 9) y el RGPD
 * (UE, arts. 13-14). PENDIENTE de validación por el área jurídica del CIESS.
 */
export const AVISO: Record<Idioma, { titulo: string; actualizado: string; bloques: BloqueAviso[] }> = {
  es: {
    titulo: 'Aviso de privacidad y consentimiento de tratamiento de datos personales',
    actualizado: 'Última actualización: versión 1.2',
    bloques: [
      {
        titulo: '1. Responsable del tratamiento',
        parrafos: [
          'El Centro Interamericano de Estudios de Seguridad Social (CIESS), órgano de docencia, capacitación e investigación de la Conferencia Interamericana de Seguridad Social (CISS), con domicilio en la Ciudad de México, es responsable del tratamiento de los datos personales recabados a través de este formulario de registro.',
          'Para cualquier asunto relacionado con este aviso puede escribir al correo de contacto del comité organizador indicado en el formulario.',
        ],
      },
      {
        titulo: '2. Datos personales que se recaban',
        parrafos: [
          'Datos de identificación y contacto: nombre, apellidos, género (opcional), correo electrónico, teléfono, institución de adscripción, cargo, país, entidad federativa y ciudad de residencia, nacionalidad e identificador ORCID.',
          'Datos académicos: modalidad de participación, eje temático, título y resumen de la ponencia, palabras clave, coautoría, semblanza, línea de investigación y fotografía de retrato.',
          'Datos logísticos: requerimientos de alojamiento y traslado, datos de vuelo o corrida, contacto de emergencia y datos de facturación cuando se soliciten.',
          'Datos sensibles: régimen alimentario, alergias alimentarias y requerimientos de accesibilidad. Estos datos se recaban únicamente para garantizar su seguridad y participación en igualdad de condiciones, y su tratamiento requiere su consentimiento expreso, que otorga al aceptar este aviso.',
        ],
      },
      {
        titulo: '3. Finalidades del tratamiento',
        parrafos: [
          'Finalidades primarias (necesarias para su participación): integrar el padrón oficial de participantes; elaborar el programa académico, los personificadores y las semblanzas de presentación; emitir constancias y cartas de invitación; gestionar alojamiento, traslados y alimentación; y comunicarle información logística y académica del congreso.',
          'Finalidades secundarias (opcionales): difusión de futuras actividades académicas del CIESS y de la CISS, y publicación de su semblanza, fotografía, intervención o ponencia, cuando usted lo autorice de manera específica en el formulario. Puede negarse a estas finalidades sin que ello afecte su registro.',
        ],
      },
      {
        titulo: '4. Base legal',
        parrafos: [
          'El tratamiento se sustenta en su consentimiento expreso (art. 8 de la LFPDPPP; art. 7, I y art. 11, I de la LGPD; art. 6.1.a y art. 9.2.a del RGPD) y, en lo relativo a la organización del congreso, en la ejecución de la relación derivada de su registro (art. 6.1.b del RGPD).',
        ],
      },
      {
        titulo: '5. Transferencias y encargados',
        parrafos: [
          'Sus datos se almacenan en DigitalOcean y en Google Workspace (Google Sheets y Google Drive), en calidad de encargados del tratamiento, y se utiliza Resend para el envío de los correos de confirmación. Estos proveedores pueden alojar información en servidores ubicados fuera de su país de residencia; en tales casos las transferencias se amparan en cláusulas contractuales tipo u otros mecanismos equivalentes.',
          'Los datos estrictamente necesarios se comparten con los proveedores de hotelería, transporte y alimentación contratados por la organización, únicamente para la prestación del servicio correspondiente.',
          'No se realizan transferencias comerciales ni se venden o ceden sus datos a terceros con fines distintos a los aquí descritos.',
        ],
      },
      {
        titulo: '6. Plazo de conservación',
        parrafos: [
          'Los datos se conservarán durante la organización del congreso y hasta 24 meses después de su clausura, para efectos de emisión de constancias, memorias académicas y comprobación administrativa. Concluido ese plazo se suprimen o se anonimizan de forma irreversible para fines estadísticos.',
        ],
      },
      {
        titulo: '7. Uso de almacenamiento local',
        parrafos: [
          'El sitio guarda en su navegador únicamente su preferencia de idioma y de tema (claro u oscuro), así como la sesión de acceso al panel para las personas autorizadas. No se utilizan cookies de publicidad ni de seguimiento de terceros.',
        ],
      },
      {
        titulo: '8. Cambios al aviso',
        parrafos: [
          'Cualquier modificación a este aviso se publicará en esta misma página, indicando la versión y la fecha de actualización.',
        ],
      },
    ],
  },
  en: {
    titulo: 'Privacy notice and consent to the processing of personal data',
    actualizado: 'Last updated: version 1.2',
    bloques: [
      {
        titulo: '1. Data controller',
        parrafos: [
          'The Inter-American Center for Social Security Studies (CIESS), the teaching, training and research body of the Inter-American Conference on Social Security (CISS), domiciled in Mexico City, is the controller of the personal data collected through this registration form.',
          'For any matter relating to this notice, please write to the organising committee contact address shown in the form.',
        ],
      },
      {
        titulo: '2. Personal data collected',
        parrafos: [
          'Identification and contact data: name, surname, gender (optional), e-mail address, telephone number, affiliated institution, position, country, state and city of residence, nationality and ORCID identifier.',
          'Academic data: type of participation, thematic axis, title and abstract of the paper, keywords, co-authorship, biography, line of research and portrait photograph.',
          'Logistical data: accommodation and transfer requirements, flight or coach details, emergency contact and invoicing details where requested.',
          'Special category data: dietary regime, food allergies and accessibility requirements. These data are collected solely to safeguard your health and ensure your participation on equal terms; their processing requires your explicit consent, which you give by accepting this notice.',
        ],
      },
      {
        titulo: '3. Purposes of processing',
        parrafos: [
          'Primary purposes (necessary for your participation): compiling the official roster of participants; preparing the academic programme, name plates and introductory biographies; issuing certificates and invitation letters; arranging accommodation, transfers and catering; and sending you logistical and academic information about the congress.',
          'Secondary purposes (optional): dissemination of future academic activities of CIESS and CISS, and publication of your biography, photograph, intervention or paper, where you specifically authorise it in the form. You may refuse these purposes without affecting your registration.',
        ],
      },
      {
        titulo: '4. Legal basis',
        parrafos: [
          'Processing is based on your explicit consent (art. 8 LFPDPPP; art. 7(I) and art. 11(I) LGPD; art. 6(1)(a) and art. 9(2)(a) GDPR) and, as regards the organisation of the congress, on the performance of the relationship arising from your registration (art. 6(1)(b) GDPR).',
        ],
      },
      {
        titulo: '5. Transfers and processors',
        parrafos: [
          'Your data are stored in DigitalOcean and Google Workspace (Google Sheets and Google Drive) as processors, and Resend is used to send confirmation e-mails. These providers may host information on servers located outside your country of residence; in such cases transfers are covered by standard contractual clauses or equivalent mechanisms.',
          'Strictly necessary data are shared with the hotel, transport and catering providers contracted by the organisation, solely for the provision of the corresponding service.',
          'No commercial transfers are made and your data are never sold or assigned to third parties for purposes other than those described here.',
        ],
      },
      {
        titulo: '6. Retention period',
        parrafos: [
          'Data are retained throughout the organisation of the congress and for up to 24 months after its closing, for the purpose of issuing certificates, academic proceedings and administrative verification. After that period they are deleted or irreversibly anonymised for statistical purposes.',
        ],
      },
      {
        titulo: '7. Local storage',
        parrafos: [
          'The site stores in your browser only your language and theme (light or dark) preference, plus the panel session for authorised users. No advertising or third-party tracking cookies are used.',
        ],
      },
      {
        titulo: '8. Changes to this notice',
        parrafos: [
          'Any amendment to this notice will be published on this same page, indicating the version and the date of update.',
        ],
      },
    ],
  },
  pt: {
    titulo: 'Aviso de privacidade e consentimento para o tratamento de dados pessoais',
    actualizado: 'Última atualização: versão 1.2',
    bloques: [
      {
        titulo: '1. Controlador dos dados',
        parrafos: [
          'O Centro Interamericano de Estudos de Seguridade Social (CIESS), órgão de docência, capacitação e pesquisa da Conferência Interamericana de Seguridade Social (CISS), com sede na Cidade do México, é o controlador dos dados pessoais coletados por meio deste formulário de inscrição.',
          'Para qualquer assunto relacionado a este aviso, escreva para o e-mail de contato do comitê organizador indicado no formulário.',
        ],
      },
      {
        titulo: '2. Dados pessoais coletados',
        parrafos: [
          'Dados de identificação e contato: nome, sobrenome, gênero (opcional), e-mail, telefone, instituição de vínculo, cargo, país, estado e cidade de residência, nacionalidade e identificador ORCID.',
          'Dados acadêmicos: modalidade de participação, eixo temático, título e resumo do trabalho, palavras-chave, coautoria, minibiografia, linha de pesquisa e fotografia de retrato.',
          'Dados logísticos: necessidades de hospedagem e traslado, dados de voo ou viagem, contato de emergência e dados de faturamento quando solicitados.',
          'Dados sensíveis: regime alimentar, alergias alimentares e requisitos de acessibilidade. Esses dados são coletados exclusivamente para garantir sua segurança e sua participação em igualdade de condições, e seu tratamento exige consentimento específico e destacado, que você concede ao aceitar este aviso (art. 11, I da LGPD).',
        ],
      },
      {
        titulo: '3. Finalidades do tratamento',
        parrafos: [
          'Finalidades primárias (necessárias à sua participação): compor a lista oficial de participantes; elaborar o programa acadêmico, os identificadores de mesa e as apresentações biográficas; emitir certificados e cartas-convite; organizar hospedagem, traslados e alimentação; e comunicar informações logísticas e acadêmicas do congresso.',
          'Finalidades secundárias (opcionais): divulgação de futuras atividades acadêmicas do CIESS e da CISS e publicação da sua minibiografia, fotografia, intervenção ou trabalho, quando você autorizar de forma específica no formulário. A recusa a essas finalidades não afeta sua inscrição.',
        ],
      },
      {
        titulo: '4. Base legal',
        parrafos: [
          'O tratamento fundamenta-se no seu consentimento (art. 7, I e art. 11, I da LGPD; art. 8 da LFPDPPP; art. 6.1.a e art. 9.2.a do RGPD) e, quanto à organização do congresso, na execução da relação decorrente da sua inscrição (art. 6.1.b do RGPD).',
        ],
      },
      {
        titulo: '5. Transferências e operadores',
        parrafos: [
          'Seus dados são armazenados na DigitalOcean e no Google Workspace (Google Sheets e Google Drive), na qualidade de operadores, e o Resend é utilizado para o envio dos e-mails de confirmação. Esses fornecedores podem hospedar informações em servidores fora do seu país de residência; nesses casos, as transferências internacionais são amparadas por cláusulas contratuais padrão ou mecanismos equivalentes.',
          'Os dados estritamente necessários são compartilhados com os fornecedores de hotelaria, transporte e alimentação contratados pela organização, apenas para a prestação do serviço correspondente.',
          'Não há transferências comerciais, nem venda ou cessão dos seus dados a terceiros para finalidades distintas das aqui descritas.',
        ],
      },
      {
        titulo: '6. Prazo de conservação',
        parrafos: [
          'Os dados serão conservados durante a organização do congresso e por até 24 meses após o seu encerramento, para fins de emissão de certificados, anais acadêmicos e comprovação administrativa. Encerrado esse prazo, são eliminados ou anonimizados de forma irreversível para fins estatísticos.',
        ],
      },
      {
        titulo: '7. Armazenamento local',
        parrafos: [
          'O site guarda no seu navegador apenas a preferência de idioma e de tema (claro ou escuro), além da sessão de acesso ao painel para pessoas autorizadas. Não são utilizados cookies de publicidade nem de rastreamento de terceiros.',
        ],
      },
      {
        titulo: '8. Alterações neste aviso',
        parrafos: [
          'Qualquer alteração neste aviso será publicada nesta mesma página, indicando a versão e a data de atualização.',
        ],
      },
    ],
  },
};
