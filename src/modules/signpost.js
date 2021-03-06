require('dotenv').config();
const request = require("request");

const transifexUtils = require('./transifex-utils');

const project = process.env.TRANSIFEX_PROJECT_SLUG_SERVICES;


module.exports = function (req, res) {
    //Every time a Service is posted to this hook Create or update Transifex Resource
    const {
        service,
        service_i18ns,
        language
    } = req.body;

    console.log('signpost.js -> req.body', req.body);

    if (!service || !service.name || !service.slug) {
        console.log("Wrong Service data.");
        return res.status(400).send("Wrong Service data.");
    }
    console.log("generateContentForTransifex");
    let content = transifexUtils.generateContentForTransifex({
        content: service.description,
        title: service.name,
    })

    console.log("generatePayloadForTransifex");
    let payload = {
        slug: service.slug,
        name: service.name,
        i18n_type: "HTML",
        accept_translations: true,
        categories: service.categories
    };
    let serviceProject;
    if (service.transifexProject) {
        console.log("service.transifexProject->" + service.transifexProject)
        serviceProject = service.transifexProject;
    } else {
        serviceProject = project;
    }
    //Checking if resource is already created
    console.log("Checking if resource is already created");
    transifexUtils.getTransifexResourceBySlug(serviceProject, payload.slug, (__e, r, __b) => {
        //if article doesn't exists, create it, else update it:
        if (r && r.statusCode === 404) {
            //if article doesn't exists, create it, else update it:
            console.log("createTransifexResource");
            let promise = new Promise((resolve, reject) => {
                transifexUtils.createTransifexResource(
                    serviceProject,                                //project
                    payload,                                //payload
                    (e1, r1, b1) => {
                        if (e1) {
                            console.log("return reject(e1);")
                            reject(e1);
                        }
                        if (r1 && r1.statusCode > 201) {
                            //upload error to Slack
                            console.log('upload error to Slack Error', payload.slug);
                            request({
                                method: 'post',
                                uri: 'https://hooks.slack.com/services/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',
                                headers: {
                                    ContentType: "application/json",
                                },
                                json: true,
                                body: {
                                    text: `*TRANSIFEX UPLOAD ERROR*\nArticle with slug ${payload.slug}, failed to upload to transifex.\nResponse from transifex servers: ${b1}.`,
                                    attachments: [{
                                        title: 'What went to transifex',
                                        text: JSON.stringify(payload)
                                    }]
                                }
                            }, () => {
                                console.log('Hooked')
                            })
                            return reject(r1);
                        }
                        else {
                            console.log("uploadTransifexResourceFile");
                            transifexUtils.uploadTransifexResourceFile(
                                serviceProject,
                                payload.slug,
                                transifexUtils.unicodeEscape(content),
                                false,
                                (e1, r1, b1) => {
                                    if (e1) {
                                        console.log("return reject(e1);")
                                        return reject(e1);
                                    }
                                    if (r1 && r1.statusCode > 202) {
                                        //upload error to Slack
                                        console.log('Error', payload.slug);
                                        request({
                                            method: 'post',
                                            uri: 'https://hooks.slack.com/services/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',
                                            headers: {
                                                ContentType: "application/json",
                                            },
                                            json: true,
                                            body: {
                                                text: `*TRANSIFEX UPLOAD ERROR*\nArticle with slug ${payload.slug}, failed to upload to transifex.\nResponse from transifex servers: ${b1}.`,
                                                attachments: [{
                                                    title: 'What went to transifex',
                                                    text: JSON.stringify(payload)
                                                }]
                                            }
                                        }, () => {
                                            console.log('Hooked')
                                        })
                                        return reject(r1);
                                    }
                                    else {
                                        request({
                                            method: 'post',
                                            headers: {
                                                ContentType: "application/json",
                                            },
                                            json: true,
                                            uri: 'https://hooks.slack.com/services/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',
                                            body: {
                                                text: `Hi! I just uploaded ${payload.slug} successfully to transifex.`
                                            }
                                        }, () => {
                                            console.log('Success Hooked')
                                            resolve(r1)
                                        })
                                    }
                                });
                        }
                    }
                );
            })
            promise
                .then((r) => {
                    console.log("{message: 'Created in Transifex', resourceId: " + r.body.data.id + "}");
                    return res.status(200).send({ message: 'Created in Transifex', resourceId: r.body.data.id });
                })
                .catch(e => {
                    //console.log("Error", e)
                    return res.status(500).send({ message: 'Error en catch 1', error: e });
                })
        } else if (r && r.statusCode === 200) {
            console.log("Resource already exists in Transifex");
            if (process.env.TRANSIFEX_UPLOAD_TRANSLATIONS == 1 && service_i18ns) {
                for (const s of service_i18ns) {
                    console.log("uploadTransifexResourceFileTranslation -> using: ", s);
                    transifexUtils.uploadTransifexResourceFileTranslation(
                        serviceProject,
                        s.slug,
                        transifexUtils.unicodeEscape(
                            transifexUtils.generateContentForTransifex({
                                content: s.description,
                                title: s.name,
                            })),
                        s.language,
                        (e1, r1) => {
                            console.log("uploadTransifexResourceFileTranslation -> r1: ", r1)
                            if (e1) {
                                console.log("uploadTransifexResourceFileTranslation -> Error: ", e1)
                            }
                        }
                    );
                }
            }
            let promise = new Promise((resolve, reject) => {
                transifexUtils.uploadTransifexResourceFile(
                    serviceProject,
                    service.slug,
                    transifexUtils.unicodeEscape(content),                            //project
                    (e1, r1) => {
                        console.log("r1: " + JSON.stringify(r1))
                        if (e1) {
                            console.log("return reject(e1);")
                            return reject(e1);
                        }
                        if (r1.statusCode > 202) {
                            //upload error to Slack
                            console.log('Error >202', payload.slug);
                            request({
                                method: 'post',
                                uri: 'https://hooks.slack.com/services/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',
                                headers: {
                                    ContentType: "application/json",
                                },
                                json: true,
                                body: {
                                    text: `*TRANSIFEX UPLOAD ERROR*\nArticle with slug ${payload.slug}, failed to upload to transifex.\nResponse from transifex servers: ${b1}.`,
                                    attachments: [{
                                        title: 'What went to transifex',
                                        text: JSON.stringify(payload)
                                    }]
                                }
                            }, () => {
                                console.log('Hooked')
                            })
                            return reject(r1);
                        }
                        else {
                            request({
                                method: 'post',
                                headers: {
                                    ContentType: "application/json",
                                },
                                json: true,
                                uri: 'https://hooks.slack.com/services/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',
                                body: {
                                    text: `Hi! I just uploaded ${payload.slug} successfully to transifex.`
                                }
                            }, () => {
                                console.log('Success Hooked')
                            })
                        }
                        resolve(r1)
                    });
            })
            promise
                .then((r) => {
                    console.log("{message: 'Created in Transifex', resourceId: " + JSON.stringify(r) + "}");
                    return res.status(200).send({ message: 'Created in Transifex', resourceId: JSON.parse(r.body).data.id });
                })
                .catch(e => {
                    console.log({ message: 'Error en catch', error: e });
                    return res.status(500).send({ message: 'Error en catch 2', error: e });
                });
        } else {
            console.log("An error ocurred", __e, r)
            return res.status(500).send({ message: 'Error', error: __e, response: r });
        }
    })
};
