import TestSuiteResult from '../../../model/suite-result'
import TestCaseResult from '../../../model/case-result'
import TestStepResult from '../../../model/step-result'
import Status from '../../../model/status'
import oxutil from '../../util'
import errorHelper from '../../../errors/helper'

export default class CucumberReporter {
    constructor(runnerId, cucumberEventListener, oxygenEventListener, mainReporter, options) {
        this.runnerId = runnerId
        this.suites = {}
        this.cucumberEventListener = cucumberEventListener
        this.oxygenEventListener = oxygenEventListener
        this.mainReporter = mainReporter
        this.options = options

        this.onBeforeFeature = this.onBeforeFeature.bind(this)
        this.onAfterFeature = this.onAfterFeature.bind(this)
        this.onBeforeScenario = this.onBeforeScenario.bind(this)
        this.onAfterScenario = this.onAfterScenario.bind(this)
        this.onBeforeStep = this.onBeforeStep.bind(this)
        this.onAfterStep = this.onAfterStep.bind(this)
        this.onTestEnd = this.onTestEnd.bind(this)

        this.hookEvents()
    }

    hookEvents() {
        this.cucumberEventListener.on('feature:before', this.onBeforeFeature)
        this.cucumberEventListener.on('feature:after', this.onAfterFeature)
        this.cucumberEventListener.on('scenario:before', this.onBeforeScenario)
        this.cucumberEventListener.on('scenario:after', this.onAfterScenario)
        this.cucumberEventListener.on('step:before', this.onBeforeStep)
        this.cucumberEventListener.on('step:after', this.onAfterStep)
        this.cucumberEventListener.on('test:end', this.onTestEnd)

        this.oxygenEventListener.on('command:before', this.onBeforeOxygenCommand)
        this.oxygenEventListener.on('command:after', this.onAfterOxygenCommand)
    }

    onBeforeOxygenCommand(event) {        
    }

    onAfterOxygenCommand(event) {

    }

    onBeforeFeature(uri, feature) {        
        const location = `${uri}:${feature.location.line}`
        const suiteResult = this.suites[location] = new TestSuiteResult()
        suiteResult.name = feature.name
        suiteResult.tags = this.simplifyCucumberTags(feature.tags)
        suiteResult.location = location
        suiteResult.startTime = oxutil.getTimeStamp();

        if (this.mainReporter.onSuiteStart && typeof this.mainReporter.onSuiteStart === 'function') {
            this.mainReporter.onSuiteStart(this.runnerId, uri, suiteResult)
        }        
        if (this.options && typeof this.options.beforeSuite === 'function') {
            this.options.beforeSuite(suiteResult);
        }
    }

    onAfterFeature(uri, feature) {
        const location = `${uri}:${feature.location.line}`
        const suiteResult = this.suites[location]
        if (!suiteResult) {
            return;
        }
        //delete this.suites[location]
        suiteResult.endTime = oxutil.getTimeStamp()
        suiteResult.duration = suiteResult.endTime - suiteResult.startTime
        suiteResult.status = this.determineSuiteStatus(suiteResult)
        this.mainReporter.onSuiteEnd(this.runnerId, uri, suiteResult)

        if (this.mainReporter.onSuiteEnd && typeof this.mainReporter.onSuiteEnd === 'function') {
            this.mainReporter.onSuiteEnd(this.runnerId, uri, suiteResult)
        }        
    }

    onBeforeScenario(uri, feature, scenario) {
        const suiteId = `${uri}:${feature.location.line}`        
        const caseLocation = scenario.locations.length > 0 ? scenario.locations[0] : { line: 1 };
        const caseId = `${uri}:${caseLocation.line}`
        const suiteResult = this.suites[suiteId]
        const cases = suiteResult.cases;
        const caseResult = new TestCaseResult()
        caseResult.name = scenario.name
        caseResult.tags = this.simplifyCucumberTags(scenario.tags)
        caseResult.location = caseId
        caseResult.startTime = oxutil.getTimeStamp()
        cases.push(caseResult)

        if (this.mainReporter.onCaseStart && typeof this.mainReporter.onCaseStart === 'function') {
            this.mainReporter.onCaseStart(this.runnerId, uri, caseId)
        }        
    }

    onAfterScenario(uri, feature, scenario, sourceLocation) {
        const suiteId = `${uri}:${feature.location.line}`
        const caseId = `${uri}:${sourceLocation.line}`
        const suiteResult = this.suites[suiteId]
        const cases = suiteResult.cases;
        const caseResult = cases.find(x => x.location === caseId)
        if (!caseResult) {
            return
        }
        caseResult.endTime = oxutil.getTimeStamp()
        caseResult.duration = caseResult.endTime - caseResult.startTime
        caseResult.status = this.determineCaseStatus(caseResult)
        if (this.mainReporter.onCaseEnd && typeof this.mainReporter.onCaseEnd === 'function') {
            this.mainReporter.onCaseEnd(this.runnerId, uri, caseId, caseResult)
        }
    }

    onBeforeStep(uri, feature, scenario, step, sourceLocation) {
        const suiteId = `${uri}:${feature.location.line}`
        const caseId = `${uri}:${sourceLocation.line}`
        const suiteResult = this.suites[suiteId]
        const cases = suiteResult.cases;
        const caseResult = cases.find(x => x.location === caseId)
        const stepResult = new TestStepResult()
        caseResult.steps.push(stepResult);
        
        stepResult.name = step.text
        stepResult.startTime = oxutil.getTimeStamp()
        stepResult.location = `${uri}:${step.location.line}`
        if (this.mainReporter.onStepStart && typeof this.mainReporter.onStepStart === 'function') {
            this.mainReporter.onStepStart(this.runnerId, uri, caseId, stepResult)
        }
    }

    onAfterStep(uri, feature, scenario, step, result, sourceLocation) {
        const suiteId = `${uri}:${feature.location.line}`
        const caseId = `${uri}:${sourceLocation.line}`
        const suiteResult = this.suites[suiteId]
        const cases = suiteResult.cases;
        const caseResult = cases.find(x => x.location === caseId)
        const stepLocation = `${uri}:${step.location.line}`
        const stepResult = caseResult.steps.find(x => x.location === stepLocation)
        
        stepResult.endTime = oxutil.getTimeStamp()
        stepResult.duration = stepResult.endTime - stepResult.startTime
        stepResult.status = result.status
        // get failure details if error was thrown in the step
        if (result.exception) {
            stepResult.failure = errorHelper.getFailureFromError(result.exception)
        }        

        if (this.mainReporter.onStepEnd && typeof this.mainReporter.onStepEnd === 'function') {
            this.mainReporter.onStepEnd(this.runnerId, uri, caseId, stepResult)
        }
    }

    onTestEnd(result) {

    }

    determineCaseStatus(caseResult) {        
        const hasFailedStep = caseResult.steps.some(x => x.status === Status.FAILED)            
        if (hasFailedStep) {
            return Status.FAILED
        }
        return Status.PASSED
    }

    determineSuiteStatus(suiteResult) {
        const hasFailedCase = suiteResult.cases.some(x => x.status === Status.FAILED)
        if (hasFailedCase) {
            return Status.FAILED
        }
        return Status.PASSED
    }

    // removes all unnecessary metadata from Cucumber tags, returning a simple array of tag names
    simplifyCucumberTags(tags) {
        if (!Array.isArray(tags) || tags.length == 0) {
            return tags;
        }
        const simpleTags = [];
        for (let tag of tags) {
            simpleTags.push(tag.name);
        }
        return simpleTags;
    }
}