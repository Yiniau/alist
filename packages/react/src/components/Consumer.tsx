import React from 'react'
import useConsumer from '../hooks/useConsumer'

const ConsumerProvider: React.FC<any> = (props = {}) => {
    const { children, render, ...others } = props
    const { list, state, type } = useConsumer(others)
    const comaptChildren = render || children

    let element
    if (typeof comaptChildren === 'function') {
        const compatList = list
        element = comaptChildren(compatList,{ state, type })
    } else {
        element = comaptChildren || React.Fragment
    }

    return element
}

export default ConsumerProvider