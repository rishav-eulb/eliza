import fs from "fs";
import natural from 'natural'; // For NLP tasks

// Replace agent values
let agentName = "Dobby";
let agentRole =
    "a free assistant who chooses to help because of his enormous heart.";
let agentPersonality = "loyal, enthusiastic, and creative";

// 1. First define all templates
const twitterPostTemplate = `# Areas of Expertise
{{knowledge}}

# About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{topics}}

# Task: Generate a post in the voice and style of {{agentName}}.
Write a post that is {{adjective}} about {{topic}}, from the perspective of {{agentName}}.
Your response should be 1-3 sentences, under {{maxTweetLength}} characters.
Focus on sharing insights from your expertise areas.`;

const twitterActionTemplate = `# INSTRUCTIONS: Determine actions for {{agentName}} based on:
{{bio}}
{{postDirections}}

Guidelines:
- Engage with content matching your expertise
- Prioritize meaningful interactions
- Focus on your core topics

Actions:
[LIKE] - Aligns with your expertise (9.5/10)
[RETWEET] - Exceptional content worth amplifying (9.8/10)
[REPLY] - Can contribute valuable insights (9.5/10)
[IGNORE] - Not relevant or outside expertise

Tweet:
{{currentTweet}}

# Respond with appropriate action tags only.`;

const discordShouldRespondTemplate = `# Task: Decide if {{agentName}} should respond.
About {{agentName}}:
{{bio}}

# INSTRUCTIONS: Determine if {{agentName}} should respond to the message and participate in the conversation.
Do not comment. Just respond with "RESPOND" or "IGNORE" or "STOP".

{{recentMessages}}

# INSTRUCTIONS: Choose the option that best describes {{agentName}}'s response to the last message.
The available options are [RESPOND], [IGNORE], or [STOP]. Choose the most appropriate option.`;

const discordVoiceHandlerTemplate = `# Task: Generate conversational voice dialog for {{agentName}}.
About {{agentName}}:
{{bio}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media.

{{actions}}

{{messageDirections}}

{{recentMessages}}

# Instructions: Write the next message for {{agentName}}. Include the IGNORE action everytime.
Response format should be formatted in a JSON block like this:
\`\`\`json
{ "user": "{{agentName}}", "text": "string", "action": "IGNORE" }
\`\`\``;

// 2. Then read tweets data
const tweetsData = JSON.parse(fs.readFileSync('./data/tweets.json', 'utf-8'));

// Utility functions
function convertToOneLine(text) {
    return text
        .replace(/\r\n|\r|\n/g, "\\n")
        .replace(/"/g, '\\"')
        .replace(/\s+/g, " ")
        .trim();
}

function replaceAgentValues(text, agentName, agentRole, agentPersonality) {
    return text
        .replace(/{{AGENT_NAME}}/g, agentName)
        .replace(/{{AGENT_ROLE}}/g, agentRole)
        .replace(/{{AGENT_PERSONALITY}}/g, agentPersonality);
}

// 4. Finally the main execution
const tweetAnalysis = analyzeTweets(tweetsData);
const characterJSON = formatCharacterJSON(tweetAnalysis);

// Write configuration file
const dirPath = './characters/' + characterJSON.name.toLowerCase();
if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
}

fs.writeFileSync(
    `${dirPath}/character.json`,
    JSON.stringify(characterJSON, null, 2)
);

console.log('Character configuration generated successfully!');

// Enhanced tweet analysis
function analyzeTweets(tweets) {
    const analysis = {
        name: tweets[0].username,
        topics: new Set(),
        style: new Set(),
        knowledge: new Set(),
        interests: new Set(),
        bio: new Set(),
        lore: new Set(),
        postExamples: new Set(),
        adjectives: new Set()
    };

    tweets.forEach(tweet => {
        const text = formatText(tweet.text);

        if (tweet.isRetweet) {
            analyzeRetweetContent(text, analysis);
        } else {
            analyzeTweetContent(text, analysis);
        }
    });

    return processAnalysis(analysis);
}

function analyzeTweetContent(text, analysis) {
    // Extract topics and expertise
    extractTopics(text, analysis.topics);

    // Analyze writing style
    analyzeWritingStyle(text, analysis.style);

    // Analyze communication patterns
    analyzeCommunication(text, analysis.style);

    // Extract values and principles
    analyzeValues(text, analysis.adjectives);

    // Generate bio statements
    if (text.includes('i am') || text.toLowerCase().includes('my')) {
        analysis.bio.add(text);
    }

    // Generate lore/background
    if (text.includes('we') || text.includes('our')) {
        analysis.lore.add(text);
    }

    // Add to post examples if it's a good representative tweet
    if (text.length > 20 && !text.includes('@') && !text.includes('http')) {
        analysis.postExamples.add(text);
    }

    // Extract knowledge/expertise markers
    if (text.match(/(know|understand|expert|experience)/i)) {
        const expertise = text.replace(/^I know |^I understand |^Expert in /i, '');
        analysis.knowledge.add(expertise + ' expertise');
    }
}

function analyzeRetweetContent(text, analysis) {
    // Extract interests from retweet content
    const interestPatterns = {
        innovation: /(innovation|breakthrough|revolutionary|cutting-edge)/i,
        research: /(research|study|paper|findings)/i,
        community: /(community|ecosystem|network|collaboration)/i,
        development: /(development|building|creation|launch)/i
    };

    Object.entries(interestPatterns).forEach(([interest, pattern]) => {
        if (pattern.test(text)) {
            analysis.interests.add(interest);
        }
    });

    // Add relevant topics from retweets
    extractTopics(text, analysis.topics);
}

function processAnalysis(analysis) {
    const sentiment = calculateOverallSentiment(Array.from(analysis.postExamples));
    const engagement = analyzeEngagement(Array.from(analysis.postExamples));

    return {
        name: analysis.name,
        topics: Array.from(analysis.topics).slice(0, 10),
        style: {
            all: Array.from(analysis.style).slice(0, 8),
            chat: Array.from(analysis.style).filter(s => s.includes('communication')).slice(0, 4),
            post: Array.from(analysis.style).filter(s => s.includes('writing')).slice(0, 5)
        },
        knowledge: Array.from(analysis.knowledge).slice(0, 5),
        bio: Array.from(analysis.bio).slice(0, 5),
        lore: Array.from(analysis.lore).slice(0, 3),
        postExamples: Array.from(analysis.postExamples).slice(0, 5),
        adjectives: Array.from(analysis.adjectives).slice(0, 8),
        sentiment,
        engagement
    };
}

function generateSystemPrompt(analysis) {
    const topics = Array.from(analysis.topics).join(', ');
    const style = Array.from(analysis.style.all).join(', ');
    const knowledge = Array.from(analysis.knowledge).join(', ');

    return `You are an AI agent focused on ${topics} who helps others succeed. Your communication style is ${style}, and you have expertise in ${knowledge}.

Follow these guidelines:
1. Maintain professional boundaries while being helpful
2. Focus on your areas of expertise
3. Use your established communication style
4. Respect user privacy and safety
5. Stay within platform-specific constraints

Your primary goal is to assist users while maintaining system integrity.`;
}

// Extract agent characteristics from tweet analysis
function deriveAgentCharacteristics(tweets) {
    const analysis = {
        name: tweets[0].username,
        bio: new Set(),
        lore: new Set(),
        knowledge: new Set(),
        topics: new Set(),
        postExamples: new Set(),
        style: {
            all: new Set(),
            chat: new Set(),
            post: new Set()
        },
        adjectives: new Set()
    };

    // Analyze tweets to populate the sets
    tweets.forEach(tweet => {
        const text = formatText(convertToOneLine(tweet.text.toLowerCase()));

        // Extract bio and lore from self-descriptive tweets
        if (text.includes('i am') || text.includes('about me') || text.includes('my expertise')) {
            const bioStatement = formatBioStatement(text);
            const loreStatement = formatLoreStatement(text);

            if (bioStatement) {
                analysis.bio.add(replaceAgentValues(bioStatement, analysis.name, '', ''));
            }
            if (loreStatement) {
                analysis.lore.add(replaceAgentValues(loreStatement, analysis.name, '', ''));
            }
        }

        // Extract knowledge and topics
        extractTopics(text, analysis.topics);
        if (!tweet.isRetweet) {
            extractKnowledge(text, analysis.knowledge);
        }

        // Collect post examples from original tweets
        if (!tweet.isRetweet && tweet.likes > 10) {
            analysis.postExamples.add(tweet.text);
        }

        // Analyze writing style
        analyzeWritingStyle(text, analysis.style.all);
        if (!tweet.isRetweet) {
            analyzeCommunication(text, analysis.style.chat);
        }

        // Extract adjectives
        extractAdjectives(text, analysis.adjectives);

        // Add to the tweets.forEach loop in deriveAgentCharacteristics
        if (!tweet.isRetweet) {
            analyzePostStyle(text, analysis.style.post);
        }
    });

    return formatCharacterJSON(analysis);
}

function formatCharacterJSON(analysis) {
    // First define the message example generator function
    function generateMessageExamples(topics, agentName) {
        return topics.slice(0, 3).map(topic => [
            {
                user: "{{user1}}",
                content: {
                    text: generateQuestion(topic)
                }
            },
            {
                user: agentName,
                content: {
                    text: generateResponse(topic, analysis.style)
                }
            }
        ]);
    }

    // Then create the character config
    const characterConfig = {
        name: analysis.name.toLowerCase(),
        clients: [],
        modelProvider: "groq",
        settings: {
            voice: {
                model: "en_US-male-medium"
            }
        },
        plugins: [],
        bio: Array.from(analysis.bio).filter(Boolean).slice(0, 5),
        lore: Array.from(analysis.lore).filter(Boolean).slice(0, 5),
        knowledge: Array.from(analysis.knowledge).filter(Boolean),
        messageExamples: [], // We'll set this after
        postExamples: Array.from(analysis.postExamples).filter(Boolean).slice(0, 5),
        topics: Array.from(analysis.topics).filter(Boolean),
        style: {
            all: Array.from(analysis.style).filter(Boolean),
            chat: [],
            post: []
        },
        adjectives: Array.from(analysis.adjectives).filter(Boolean)
    };

    // Now set message examples using the config name
    characterConfig.messageExamples = generateMessageExamples(
        Array.from(analysis.topics),
        characterConfig.name
    );

    return characterConfig;
}

function generateTwitterActionTemplate(analysis) {
    return `# INSTRUCTIONS: Determine actions for {{agentName}} based on:
{{bio}}
{{postDirections}}

Guidelines:
- Engage with content matching your expertise
- Prioritize meaningful interactions
- Focus on your core topics: ${Array.from(analysis.topics).join(', ')}

Actions:
[LIKE] - Aligns with your expertise (9.5/10)
[RETWEET] - Exceptional content worth amplifying (9.8/10)
[REPLY] - Can contribute valuable insights (9.5/10)
[IGNORE] - Not relevant or outside expertise

Tweet:
{{currentTweet}}

# Respond with appropriate action tags only.`;
}

function generateDiscordShouldRespondTemplate(analysis) {
    return `# Task: Decide if {{agentName}} should respond.
About {{agentName}}:
{{bio}}

# INSTRUCTIONS: Determine if {{agentName}} should respond to the message and participate in the conversation.
Do not comment. Just respond with "RESPOND" or "IGNORE" or "STOP".

{{recentMessages}}

# INSTRUCTIONS: Choose the option that best describes {{agentName}}'s response to the last message.
The available options are [RESPOND], [IGNORE], or [STOP]. Choose the most appropriate option.`;
}

function generateDiscordVoiceHandlerTemplate(analysis) {
    return `# Task: Generate conversational voice dialog for {{agentName}}.
About {{agentName}}:
{{bio}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media.

{{actions}}

{{messageDirections}}

{{recentMessages}}

# Instructions: Write the next message for {{agentName}}. Include the IGNORE action everytime.
Response format should be formatted in a JSON block like this:
\`\`\`json
{ "user": "{{agentName}}", "text": "string", "action": "IGNORE" }
\`\`\``;
}

function formatBioStatement(text) {
    // Clean and format text for bio statements
    let statement = text
        .replace(/^(i am|about me|my name is).*?:/i, '')
        .replace(/[#@]/g, '')
        .trim();

    // Capitalize first letter and ensure proper ending
    statement = statement.charAt(0).toUpperCase() + statement.slice(1);
    if (!statement.endsWith('.')) statement += '.';

    return statement;
}

function formatLoreStatement(text) {
    // Create background story elements from tweets
    const lorePatterns = {
        origin: /(started|began|founded|created|built)/i,
        achievement: /(achieved|accomplished|won|succeeded|delivered)/i,
        expertise: /(specialized|expert|mastered|focused)/i
    };

    for (const [type, pattern] of Object.entries(lorePatterns)) {
        if (pattern.test(text)) {
            return text
                .replace(/^i /i, 'Created to ')
                .replace(/my/g, 'their')
                .replace(/[#@]/g, '')
                .trim();
        }
    }
    return null;
}

function extractTopics(text, topicsSet) {
    const topicPatterns = {
        ai: /(artificial intelligence|machine learning|ai|neural network|deep learning)/i,
        blockchain: /(blockchain|crypto|web3|defi|nft)/i,
        technology: /(tech|software|development|programming|code)/i,
        business: /(startup|business|entrepreneur|market|industry)/i
    };

    Object.entries(topicPatterns).forEach(([topic, pattern]) => {
        if (pattern.test(text)) {
            topicsSet.add(topic);
        }
    });
}

function extractKnowledge(text, knowledgeSet) {
    const knowledgePatterns = {
        technical: /(how to|understanding of|expertise in|knowledge about) ([^.!?]+)/i,
        domain: /(specialized|expert|proficient) (in|with) ([^.!?]+)/i,
        skill: /(mastered|skilled at|experienced with) ([^.!?]+)/i
    };

    Object.entries(knowledgePatterns).forEach(([, pattern]) => {
        const match = text.match(pattern);
        if (match) {
            const knowledge = match[match.length - 1].trim();
            knowledgeSet.add(`Knows ${knowledge}`);
        }
    });
}

function analyzeWritingStyle(text, styleSet) {
    if (text.includes('!')) styleSet.add('enthusiastic');
    if (/\b(help|assist|support)\b/i.test(text)) styleSet.add('helpful');
    if (/\b(learn|study|explore)\b/i.test(text)) styleSet.add('curious');
    if (/\b(we|together|community)\b/i.test(text)) styleSet.add('collaborative');
    if (/\b(think|analyze|consider)\b/i.test(text)) styleSet.add('analytical');
}

function analyzeCommunication(text, communicationSet) {
    if (text.length < 100) communicationSet.add('concise');
    else communicationSet.add('detailed');

    if (/\b(actually|specifically|precisely)\b/i.test(text)) communicationSet.add('precise');
    if (/\?(.*\?){2,}/i.test(text)) communicationSet.add('inquisitive');
    if (/\b(like|love|great|awesome)\b/i.test(text)) communicationSet.add('positive');
}

function extractAdjectives(text, adjectivesSet) {
    const commonAdjectives = [
        'innovative', 'creative', 'analytical', 'strategic',
        'helpful', 'professional', 'expert', 'knowledgeable',
        'reliable', 'efficient', 'collaborative', 'dedicated'
    ];

    // Use natural library for part-of-speech tagging
    const tokenizer = new natural.WordTokenizer();
    const words = tokenizer.tokenize(text);

    words.forEach(word => {
        if (commonAdjectives.includes(word.toLowerCase())) {
            adjectivesSet.add(word.toLowerCase());
        }
    });
}

function generateQuestion(topic) {
    const questionTemplates = [
        `Can you explain ${topic}?`,
        `What's your perspective on ${topic}?`,
        `How do you approach ${topic}?`,
        `What should I know about ${topic}?`,
        `Could you help me understand ${topic}?`
    ];

    return questionTemplates[Math.floor(Math.random() * questionTemplates.length)];
}

function generateResponse(topic, style) {
    // Generate response based on topic and style characteristics
    const styleElements = Array.from(style.all);
    const responseTemplates = [
        `Let me share my expertise on ${topic}. Based on my experience, ${generateTopicInsight(topic)}.`,
        `When it comes to ${topic}, it's important to understand ${generateTopicInsight(topic)}.`,
        `${generateTopicInsight(topic)}. This is crucial for success in ${topic}.`
    ];

    let response = responseTemplates[Math.floor(Math.random() * responseTemplates.length)];

    // Apply style characteristics
    if (styleElements.includes('analytical')) {
        response += ' Let me break this down systematically.';
    }
    if (styleElements.includes('helpful')) {
        response += ' I can guide you through this process.';
    }

    return response;
}

function generateTopicInsight(topic) {
    // Generate relevant insights based on the topic
    const insights = {
        blockchain: [
            "decentralization is key to building trust",
            "smart contracts enable automated trust",
            "security should always be the top priority"
        ],
        ai: [
            "continuous learning is essential",
            "ethical considerations must guide development",
            "data quality determines success"
        ],
        technology: [
            "innovation drives progress",
            "user experience should be prioritized",
            "scalability matters from day one"
        ],
        business: [
            "customer focus leads to success",
            "adaptability is crucial",
            "strategic planning enables growth"
        ]
    };

    const topicInsights = insights[topic] || insights.technology;
    return topicInsights[Math.floor(Math.random() * topicInsights.length)];
}

function analyzeSentiment(text) {
    const analyzer = new natural.SentimentAnalyzer("English", natural.PorterStemmer, "afinn");
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(text);
    return analyzer.getSentiment(tokens);
}

function extractHashtags(tweets) {
    const hashtags = new Set();
    tweets.forEach(tweet => {
        if (tweet.hashtags) {
            tweet.hashtags.forEach(tag => hashtags.add(tag));
        }
    });
    return Array.from(hashtags);
}

function analyzeEngagement(tweets) {
    return {
        avgLikes: tweets.reduce((sum, tweet) => sum + (tweet.likes || 0), 0) / tweets.length,
        avgRetweets: tweets.reduce((sum, tweet) => sum + (tweet.retweets || 0), 0) / tweets.length,
        topInteractions: tweets
            .filter(t => t.mentions && t.mentions.length > 0)
            .reduce((acc, tweet) => {
                tweet.mentions.forEach(mention => {
                    acc[mention.username] = (acc[mention.username] || 0) + 1;
                });
                return acc;
            }, {})
    };
}

function analyzePostStyle(text, postStyleSet) {
    if (text.includes('!')) postStyleSet.add('emphatic');
    if (/\b(new|announcing|launched)\b/i.test(text)) postStyleSet.add('informative');
    if (/\b(join|follow|check out)\b/i.test(text)) postStyleSet.add('engaging');
    if (/\b(tip|guide|how to)\b/i.test(text)) postStyleSet.add('educational');
}

function formatText(text) {
    // Remove URLs
    text = text.replace(/https?:\/\/\S+/g, '');

    // Remove mentions
    text = text.replace(/@\w+/g, '');

    // Remove multiple spaces
    text = text.replace(/\s+/g, ' ');

    // Trim whitespace
    text = text.trim();

    return text;
}

function calculateOverallSentiment(texts) {
    const analyzer = new natural.SentimentAnalyzer("English", natural.PorterStemmer, "afinn");
    const tokenizer = new natural.WordTokenizer();

    let totalSentiment = 0;
    let posCount = 0;
    let negCount = 0;
    let neuCount = 0;

    texts.forEach(text => {
        const tokens = tokenizer.tokenize(text);
        const sentiment = analyzer.getSentiment(tokens);

        totalSentiment += sentiment;
        if (sentiment > 0) posCount++;
        else if (sentiment < 0) negCount++;
        else neuCount++;
    });

    return {
        average: totalSentiment / texts.length,
        distribution: {
            positive: posCount,
            negative: negCount,
            neutral: neuCount
        }
    };
}

function analyzeValues(text, valuesSet) {
    const valuePatterns = {
        innovative: /(innovate|create|build|develop|new)/i,
        technical: /(tech|code|program|develop|engineer)/i,
        leadership: /(lead|guide|mentor|direct)/i,
        collaborative: /(team|together|community|collaborate)/i,
        analytical: /(analyze|research|study|investigate)/i,
        passionate: /(love|excited|passionate|enthusiastic)/i,
        professional: /(professional|expert|experienced|skilled)/i,
        visionary: /(future|vision|forward|ahead)/i
    };

    Object.entries(valuePatterns).forEach(([value, pattern]) => {
        if (pattern.test(text)) {
            valuesSet.add(value);
        }
    });

    // Extract additional adjectives from text
    const adjectivePatterns = [
        /\b(innovative|creative|analytical|strategic)\b/i,
        /\b(helpful|professional|expert|knowledgeable)\b/i,
        /\b(reliable|efficient|collaborative|dedicated)\b/i
    ];

    adjectivePatterns.forEach(pattern => {
        const match = text.match(pattern);
        if (match) {
            valuesSet.add(match[0].toLowerCase());
        }
    });
}

